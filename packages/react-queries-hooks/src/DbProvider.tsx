import {
  IDb,
  IInitDbClientConfig,
  initDbClient,
  stopDb,
} from "@kikko-land/kikko";
import React, { ReactElement, Ref, useContext, useEffect, useMemo, useRef, useState } from "react";

type IHolderState = {
  [dbKey: string]:
  | { type: "initialized"; db: IDb; config: IInitDbClientConfig }
  | { type: "initializing"; config: IInitDbClientConfig }
  | { type: "stopped" }
  | undefined;
};

export type IDbsHolderContextValue =
  Readonly<[
    state: IHolderState,
    setState: (st: IHolderState | ((st: IHolderState) => IHolderState)) => void
  ]>

const DbsHolderContext = React.createContext<IDbsHolderContextValue>([
  {},
  function () {
    throw new Error('Failed to use DbsHolderContext. Did you forget to put <DbsHolder />?')
  }
]);

export const DbsHolder: React.FC<{
  children?: React.ReactNode;
  defaultDb?: IInitDbClientConfig;
}> = ({ children, defaultDb }) => {
  const [state, setState] = useState<IHolderState>({});

  const value = useMemo(() => {
    return [state, setState] as const;
  }, [state])

  return (
    <DbsHolderContext.Provider value={value}>
      {defaultDb ? <DbProvider config={defaultDb}>{children}</DbProvider> : children}
    </DbsHolderContext.Provider>
  )
}

export const DbProvider: React.FC<{
  children?: React.ReactNode;
  config: IInitDbClientConfig;
  dbKey?: string;
}> = ({ children, config, dbKey }) => {

  const [state, setState] = useContext(DbsHolderContext);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state])

  const finalDbKey = dbKey || 'default';

  const wasStoppingRef = useRef(false)

  useEffect(() => {
    let shouldBeStopped = false;
    let initializedDb: IDb | undefined = undefined;

    if (stateRef.current[finalDbKey] && stateRef.current[finalDbKey]?.type !== 'stopped' && !wasStoppingRef.current) {
      throw new Error(`Db with '${finalDbKey}' is already provided. Did you call DbProvider twice for the same dbKey?`);
    }

    wasStoppingRef.current = false;

    const cb = async () => {
      setState((st) => ({ ...st, [finalDbKey]: { type: "initializing", config } }));

      const db = await initDbClient(config);
      initializedDb = db;

      if (shouldBeStopped) {
        void stopDb(db);

        return;
      }

      setState((st) => ({ ...st, [finalDbKey]: { type: "initialized", db, config } }));
    };

    void cb();

    return () => {
      wasStoppingRef.current = true;
      shouldBeStopped = true;

      setState((st) => ({ ...st, [finalDbKey]: { type: "stopped" } }));

      if (initializedDb) {
        // Start stopping db in next tick to
        // allow all react component to get state
        // that DB is in not initialized state
        queueMicrotask(() => {
          if (initializedDb) {
            void stopDb(initializedDb);
          }
        });
      }
    };
  }, [config, finalDbKey, setState]);

  return (<>{children}</>);
};

export const useDbsHolderState = () => {
  return useContext(DbsHolderContext)[0];
};

export const useDbState = (dbKey = 'default') => {
  const res = useDbsHolderState();
  const dbState = res[dbKey];

  if (!dbState) {
    throw new Error(`Db with key '${dbKey}' was not found. Did you forget to provide db via DbProvider?`);

  }

  return dbState;
};

export const useDb = (dbKey = 'default') => {
  const res = useDbState(dbKey);

  if (res.type === "initialized") {
    return res.db;
  } else {
    return undefined;
  }
};

export const useDbStrict = (dbKey = 'default') => {
  const db = useDb(dbKey);

  if (!db) throw new Error(`DB with key ${dbKey} is not initialized!`);

  return db;
};

export const EnsureDbLoaded: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  dbKey?: string;
}> = ({ children, dbKey, fallback }) => {
  const dbState = useDbsHolderState();

  return dbState[dbKey || 'default']?.type === "initialized"
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (children as ReactElement<any, any>)
    : fallback
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fallback as ReactElement<unknown, any>)
      : null;
};
