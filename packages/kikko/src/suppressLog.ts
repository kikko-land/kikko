import { IDb } from "./types";

export const suppressLog = <T>(db: IDb, func: (state: IDb) => T): T => {
  return func({
    ...db,
    __state: {
      ...db.__state,
      localState: {
        ...db.__state.localState,
        suppressLog: true,
      },
    },
  });
};

export const withSuppressedLog = (db: IDb): IDb => {
  return {
    ...db,
    __state: {
      ...db.__state,
      localState: { ...db.__state.localState, suppressLog: true },
    },
  };
};
