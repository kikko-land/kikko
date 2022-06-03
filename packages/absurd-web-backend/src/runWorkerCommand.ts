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

import { ICommand } from "./commands";
import { IBackendState } from "./types";

export const runWorkerCommand = (
  backendState: IBackendState,
  command: ICommand
) => {
  const { messagesFromWorker$, messagesToWorker$, stop$ } = backendState;

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

  return waitResponse;
};
