import {
  filter,
  first,
  lastValueFrom,
  map,
  of,
  switchMap,
  takeUntil,
  throwError,
  timeout,
} from "rxjs";

import { ICommand } from "../commands";
import { IDbState } from "./types";

export const runWorkerCommand = (state: IDbState, command: ICommand) => {
  if (state.sharedState.isStopped) {
    throw new Error(
      `Failed to execute function, DB ${state.sharedState.dbName} is stopped!`
    );
  }

  const { messagesFromWorker$, messagesToWorker$ } = state.sharedState;

  const waitResponse = lastValueFrom(
    messagesFromWorker$.pipe(
      filter(
        (ev) =>
          ev.type === "response" && ev.data.commandId === command.commandId
      ),
      first(),
      switchMap((ev) => {
        if (ev.type === "response" && ev.data.status === "error") {
          throw new Error(ev.data.message);
        } else {
          return of(ev);
        }
      }),
      map((ev) => {
        if (ev.type === "response" && ev.data.status === "success") {
          return ev.data.result;
        } else {
          throw new Error("Unknown data format");
        }
      }),
      timeout({
        each: 8000,
        with: () =>
          throwError(
            () =>
              new Error(
                `Failed to execute ${JSON.stringify(command)} - timeout`
              )
          ),
      }),
      takeUntil(state.sharedState.stop$)
    )
  );

  messagesToWorker$.next({
    type: "command",
    data: command,
  });

  return waitResponse;
};
