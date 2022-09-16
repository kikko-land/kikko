import { TimeoutError } from "@kikko-land/kikko";
import { EmptyError } from "rxjs";

import { ICommand } from "./commands";
import { IBackendState } from "./types";
import { IOutputWorkerMessage } from "./worker/types";

export const runWorkerCommand = async (
  backendState: IBackendState,
  command: ICommand
) => {
  const { incomingMessagesQueue, outcomingMessagesQueue } = backendState;

  const throwIfTerminated = () => {
    if (backendState.isTerminated.value) {
      throw new Error("Failed to execute command — backend is terminated.");
    }
  };

  throwIfTerminated();

  const waitResponse = (async () => {
    const msgFilter = (ev: IOutputWorkerMessage) =>
      ev.type === "response" && ev.data.commandId === command.commandId;

    throwIfTerminated();
    try {
      await incomingMessagesQueue.waitTill((msgs) => msgs.some(msgFilter), {
        stopIf: backendState.isTerminated,
        timeout: backendState.queryTimeout,
      });
    } catch (e) {
      if (e instanceof TimeoutError) {
        throw new TimeoutError(
          `Failed to execute ${JSON.stringify(
            command
          )} - timeout. You can always  increase the timeout time in the config of backend.`
        );
      }

      throw e;
    }
    throwIfTerminated();

    const responses = incomingMessagesQueue.value.filter(msgFilter);
    incomingMessagesQueue.value = incomingMessagesQueue.value.filter(
      (m) => responses.indexOf(m) === -1
    );

    if (responses.length === 0) {
      throw new Error(
        `Internal error: waitTill resolved to true(so message is found), but after state filter message was not found for command: ${JSON.stringify(
          command
        )}`
      );
    }

    if (responses.length > 1) {
      throw new Error(
        `Internal error: got multiple message for command: ${JSON.stringify(
          command
        )}. Expected only one`
      );
    }

    const result = responses[0];

    if (result.type === "response" && result.data.status === "error") {
      throw new Error(`Error: ${result.data.message}, while handling command`);
    }

    if (result.type === "response" && result.data.status === "success") {
      return result.data.result;
    } else {
      throw new Error(`Unknown data format while handle command ${command}`);
    }
  })();

  outcomingMessagesQueue.value = [
    ...outcomingMessagesQueue.value,
    {
      type: "command",
      data: command,
    },
  ];

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
