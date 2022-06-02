import { IDbState, IInitDbConfig, initDb, stopDb } from "@trong/core";
import React, { ReactElement, useContext, useEffect, useState } from "react";

export type IDbInitState =
  | { type: "initialized"; db: IDbState; config: IInitDbConfig }
  | { type: "notInitialized" }
  | { type: "initializing"; config: IInitDbConfig };

const DbContext = React.createContext<IDbInitState>({
  type: "notInitialized",
});

export const DbProvider: React.FC<{
  children?: React.ReactNode;
  config: IInitDbConfig;
}> = ({ children, config }) => {
  const [currentState, setCurrentState] = useState<IDbInitState>({
    type: "notInitialized",
  });

  useEffect(() => {
    let shouldBeStopped = false;
    let initializedDb: IDbState | undefined = undefined;

    const cb = async () => {
      setCurrentState({ type: "initializing", config });

      const db = await initDb(config);

      if (shouldBeStopped) {
        stopDb(db);

        return;
      }

      setCurrentState({ type: "initialized", db, config });
    };

    cb();

    return () => {
      shouldBeStopped = true;

      if (initializedDb) {
        stopDb(initializedDb);
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
};

export const EnsureDbLoaded: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ children, fallback }) => {
  const dbState = useDbState();

  return dbState.type === "initialized"
    ? (children as ReactElement<any, any>)
    : fallback
    ? (fallback as ReactElement<any, any>)
    : null;
};
