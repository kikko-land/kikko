import {
  IDb,
  IInitDbClientConfig,
  initDbClient,
  stopDb,
} from "@kikko-land/kikko";
import React, {
  ReactElement,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type IHolderState = {
  [dbKey: string]:
    | { type: "initialized"; db: IDb; config: IInitDbClientConfig }
    | { type: "initializing"; config: IInitDbClientConfig }
    | { type: "stopping" }
    | { type: "stopped" }
    | undefined;
};

export type IDbsHolderContextValue = Readonly<
  [
    state: IHolderState,
    setState: (st: IHolderState | ((st: IHolderState) => IHolderState)) => void,
    refState: RefObject<IHolderState>
  ]
>;

const DbsHolderContext = React.createContext<IDbsHolderContextValue>([
  {},
  function () {
    throw new Error(
      "Failed to use DbsHolderContext. Did you forget to put <DbsHolder />?"
    );
  },
  { current: {} },
]);

export const DbsHolder: React.FC<{
  children?: React.ReactNode;
  defaultDbConfig?: IInitDbClientConfig;
}> = ({ children, defaultDbConfig }) => {
  const [state, setState] = useState<IHolderState>({});
  const currentStateRef = useRef<IHolderState>(state);

  const setRefState = useCallback(
    (st: IHolderState | ((st: IHolderState) => IHolderState)) => {
      currentStateRef.current =
        st instanceof Function ? st(currentStateRef.current) : st;

      setState(st);
    },
    []
  );
  const value = useMemo(() => {
    return [state, setRefState, currentStateRef] as const;
  }, [setRefState, state]);

  return (
    <DbsHolderContext.Provider value={value}>
      {defaultDbConfig ? (
        <DbProvider config={defaultDbConfig} dbKey="default">
          {children}
        </DbProvider>
      ) : (
        children
      )}
    </DbsHolderContext.Provider>
  );
};

export const DbProvider: React.FC<{
  children?: React.ReactNode;
  config: IInitDbClientConfig;
  dbKey?: string;
}> = ({ children, config, dbKey }) => {
  const [, setState, refState] = useContext(DbsHolderContext);

  const finalDbKey = dbKey || "default";

  const [count, setCount] = useState(0);

  useEffect(() => {
    let shouldBeStopped = false;
    let initializedDb: IDb | undefined = undefined;

    if (
      refState.current?.[finalDbKey] &&
      refState.current[finalDbKey]?.type === "stopping"
    ) {
      return;
    }

    if (
      refState.current?.[finalDbKey] &&
      refState.current[finalDbKey]?.type !== "stopped"
    ) {
      throw new Error(
        `Db with '${finalDbKey}' is already provided. Did you call DbProvider twice for the same dbKey?`
      );
    }
    const stop = () => {
      const perform = async () => {
        if (initializedDb) {
          await stopDb(initializedDb);
        }
        setState((st) => ({ ...st, [finalDbKey]: { type: "stopped" } }));

        setCount((c) => c + 1);
      };

      // Start stopping db in next tick to
      // allow all react component to get state
      // that DB is in not initialized state
      queueMicrotask(() => void perform());
    };

    const cb = async () => {
      const db = await initDbClient(config);

      initializedDb = db;

      if (shouldBeStopped) {
        stop();

        return;
      }

      setState((st) => ({
        ...st,
        [finalDbKey]: { type: "initialized", db, config },
      }));
    };

    setState((st) => ({
      ...st,
      [finalDbKey]: { type: "initializing", config },
    }));
    void cb();

    return () => {
      shouldBeStopped = true;
      setState((st) => ({ ...st, [finalDbKey]: { type: "stopping" } }));

      if (initializedDb) {
        stop();
      }
    };
  }, [config, finalDbKey, refState, setState, count]);

  return <>{children}</>;
};

export const useDbsHolderState = () => {
  return useContext(DbsHolderContext)[0];
};

export const useDbState = (dbKey = "default") => {
  const res = useDbsHolderState();
  const dbState = res[dbKey];

  if (!dbState) {
    throw new Error(
      `Db with key '${dbKey}' was not found. Did you forget to provide db via DbProvider?`
    );
  }

  return dbState;
};

export const useDb = (dbKey = "default") => {
  const res = useDbState(dbKey);

  if (res.type === "initialized") {
    return res.db;
  } else {
    return undefined;
  }
};

export const useDbStrict = (dbKey = "default") => {
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

  return dbState[dbKey || "default"]?.type === "initialized"
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (children as ReactElement<any, any>)
    : fallback
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fallback as ReactElement<unknown, any>)
    : null;
};
