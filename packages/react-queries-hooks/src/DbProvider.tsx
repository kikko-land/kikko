import {
  IDbState,
  IInitDbClientConfig,
  initDbClient,
  stopDb,
} from "@kikko-land/kikko";
import React, { ReactElement, useContext, useEffect, useState } from "react";

export type IDbInitState =
  | { type: "initialized"; db: IDbState; config: IInitDbClientConfig }
  | { type: "notInitialized" }
  | { type: "initializing"; config: IInitDbClientConfig };

const DbContext = React.createContext<IDbInitState>({
  type: "notInitialized",
});

export const DbProvider: React.FC<{
  children?: React.ReactNode;
  config: IInitDbClientConfig;
}> = ({ children, config }) => {
  const [currentState, setCurrentState] = useState<IDbInitState>({
    type: "notInitialized",
  });

  useEffect(() => {
    let shouldBeStopped = false;
    let initializedDb: IDbState | undefined = undefined;

    const cb = async () => {
      setCurrentState({ type: "initializing", config });

      const db = await initDbClient(config);
      initializedDb = db;

      if (shouldBeStopped) {
        void stopDb(db);

        return;
      }

      setCurrentState({ type: "initialized", db, config });
    };

    void cb();

    return () => {
      shouldBeStopped = true;

      if (initializedDb) {
        setCurrentState({ type: "notInitialized" });

        void stopDb(initializedDb);
      }
    };
  }, [config]);

  return (
    <DbContext.Provider value={currentState}>{children}</DbContext.Provider>
  );
};

export const useDbState = () => {
  return useContext(DbContext);
};

export const useDb = () => {
  const res = useDbState();

  if (res.type === "initialized") {
    return res.db;
  } else {
    return undefined;
  }
};

export const useDbStrict = () => {
  const db = useDb();

  if (!db) throw new Error("DB is not initialized!");

  return db;
};

export const EnsureDbLoaded: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ children, fallback }) => {
  const dbState = useDbState();

  return dbState.type === "initialized"
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (children as ReactElement<any, any>)
    : fallback
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fallback as ReactElement<unknown, any>)
    : null;
};
