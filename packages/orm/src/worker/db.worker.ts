import { Subject } from "rxjs";
import {
  ICommand,
  IExecQueriesCommand,
  IRollbackTransactionCommand,
  ICommitTransactionCommand,
  IStartTransactionCommand,
  ITransferredQuery,
} from "../commands";
import { DbBackend } from "./DbBackend";

import { IInputWorkerMessage, IOutputWorkerMessage, IResponse } from "./types";

// Fix:
// 1. When transaction failed we should discard all future queries with the same
//    transactionId
class CommandsExecutor {
  private queue: ICommand[] = [];
  private currentTransactionId?: string;
  private transactionStartedAt: number = 0;

  private inlineTransactionCounter = 0;

  response$: Subject<IResponse> = new Subject();

  private pastTransactionIds: string[] = [];

  constructor(private db: DbBackend) {
    setInterval(() => {
      if (!this.currentTransactionId) return;

      if (new Date().getTime() - this.transactionStartedAt > 8000) {
        console.error(
          `Transaction id = ${this.currentTransactionId} rollbacked due to timeout of 8s!`
        );

        this.currentTransactionId = undefined;
        this.db.sqlExec("ROLLBACK;");
      }
    }, 5000);
  }

  exec(command: ICommand) {
    this.queue.push(command);

    const queue = this.queue;
    this.queue = [];

    // console.log(command, [...this.queue]);

    // console.log(
    //   `Queue to run: ${JSON.stringify(
    //     queue,
    //     null,
    //     2,
    //   )}\nCurrentCommand: ${JSON.stringify(command, null, 2)}`,
    // );

    // TODO: optimize it. We can await for commit, for example
    queue.forEach((com) => {
      this.runCommand(com);
    });
  }

  private flushQueue() {
    this.queue.forEach((com) => {
      this.runCommand(com);
    });
  }

  private runCommand(command: ICommand) {
    if (command.type === "startTransaction") {
      this.startTransaction(command);
    } else if (
      command.type === "commitTransaction" ||
      command.type === "rollbackTransaction"
    ) {
      this.commitOrRollbackTransaction(command);
      this.flushQueue();
    } else if (command.type === "runQueries") {
      this.runQuery(command);
    }
  }

  private runQuery(command: IExecQueriesCommand) {
    if (
      this.currentTransactionId &&
      (!command.transactionId ||
        command.transactionId !== this.currentTransactionId)
    ) {
      this.queue.push(command);
      return;
    }

    this.response$.next(
      this.sqlExec(
        command.commandId,
        command.queries,
        Boolean(command.spawnTransaction),
        Boolean(command.suppressLog)
      )
    );
  }

  private commitOrRollbackTransaction(
    command: IRollbackTransactionCommand | ICommitTransactionCommand
  ) {
    // TODO: could be bug here — rollbackes transaction will return is committed
    if (this.pastTransactionIds.includes(command.transactionId)) {
      this.response$.next({
        status: "success",
        commandId: command.commandId,
        transactionId: command.transactionId,
        result: [],
      });
      return;
    }

    if (
      this.currentTransactionId &&
      this.currentTransactionId === command.transactionId
    ) {
      this.response$.next(
        this.sqlExec(
          command.commandId,
          [
            command.type === "commitTransaction"
              ? { text: "COMMIT;", values: [] }
              : { text: "ROLLBACK;", values: [] },
          ],
          false,
          Boolean(command.suppressLog)
        )
      );

      this.pastTransactionIds.push(this.currentTransactionId);
      this.currentTransactionId = undefined;
    }
  }

  private startTransaction(command: IStartTransactionCommand) {
    if (this.pastTransactionIds.includes(command.transactionId)) return;
    if (this.currentTransactionId === command.transactionId) return;

    if (this.currentTransactionId) {
      this.queue.push(command);
    } else {
      this.currentTransactionId = command.transactionId;
      this.transactionStartedAt = new Date().getTime();

      this.response$.next(
        this.sqlExec(
          command.commandId,
          [{ text: "BEGIN TRANSACTION;", values: [] }],
          false,
          Boolean(command.suppressLog)
        )
      );
    }
  }

  private sqlExec(
    commandId: string,
    queries: ITransferredQuery[],
    spawnTransaction: boolean,
    suppressLog: boolean
  ): IResponse {
    const shouldSpawnTransaction =
      spawnTransaction && !this.currentTransactionId;

    try {
      if (shouldSpawnTransaction) {
        this.inlineTransactionCounter++;

        this.db.sqlExec("BEGIN TRANSACTION;", undefined, {
          transactionId: `inline${this.inlineTransactionCounter}`,
          suppressLog: suppressLog,
        });
      }

      const result = queries.map((q) => {
        return this.db.sqlExec(q.text, q.values, {
          transactionId: shouldSpawnTransaction
            ? `inline${this.inlineTransactionCounter}`
            : this.currentTransactionId,
          suppressLog: suppressLog,
        });
      });

      if (shouldSpawnTransaction) {
        this.db.sqlExec("COMMIT;", undefined, {
          transactionId: `inline${this.inlineTransactionCounter}`,
          suppressLog: suppressLog,
        });
      }

      return {
        commandId,
        status: "success",
        result,
      };
    } catch (e) {
      if (this.currentTransactionId || shouldSpawnTransaction) {
        this.db.sqlExec("ROLLBACK;", undefined, {
          transactionId: this.currentTransactionId
            ? this.currentTransactionId
            : `inline${this.inlineTransactionCounter}`,
          suppressLog: suppressLog,
        });

        if (this.currentTransactionId) {
          this.pastTransactionIds.push(this.currentTransactionId);
        }

        this.currentTransactionId = undefined;
      }

      return { commandId, status: "error", message: (e as Error).message };
    }
  }
}

// eslint-disable-next-line no-restricted-globals
const ctx: Worker = self as any;

let commandsExecutor: CommandsExecutor | undefined;

ctx.addEventListener("message", async (event) => {
  const postMessage = (m: IOutputWorkerMessage) => ctx.postMessage(m);

  const data: IInputWorkerMessage = event.data;

  if (data.type === "initialize") {
    if (commandsExecutor) {
      console.error("DB already initialized!");

      return;
    }

    const db = new DbBackend(data.dbName, data.wasmUrl);

    await db.init();

    commandsExecutor = new CommandsExecutor(db);

    postMessage({ type: "initialized" });

    commandsExecutor.response$.subscribe((r) => {
      postMessage({ type: "response", data: r });
    });
  } else {
    if (!commandsExecutor) {
      console.error("DB is not initialized");

      return;
    }

    commandsExecutor.exec(event.data.data);
  }
});
