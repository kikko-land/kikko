import {
  EmptyError,
  filter,
  firstValueFrom,
  map,
  of,
  switchMap,
  take,
  takeUntil,
  throwError,
  timeout,
} from "rxjs";

import { ICommand } from "./commands";
import { IBackendState } from "./types";

export const runWorkerCommand = async (
  backendState: IBackendState,
  command: ICommand
) => {
  const { messagesFromWorker$, messagesToWorker$, stop$ } = backendState;

  const waitResponse = firstValueFrom(
    messagesFromWorker$.pipe(
      filter(
        (ev) =>
          ev.type === "response" && ev.data.commandId === command.commandId
      ),
      take(1),
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
        each: backendState.queryTimeout,
        with: () =>
          throwError(
            () =>
              new Error(
                `Failed to execute ${JSON.stringify(command)} - timeout`
              )
          ),
      }),
      takeUntil(stop$)
    )
  );

  messagesToWorker$.next({
    type: "command",
    data: command,
  });

  try {
    return await waitResponse;
  } catch (e) {
    if (e instanceof EmptyError) {
      throw new Error(
        `Failed to run command, usually it means DB is already stopped. Command:\n${JSON.stringify(
          command,
          undefined,
          2
        )}`
      );
    }

    throw e;
  }
};
