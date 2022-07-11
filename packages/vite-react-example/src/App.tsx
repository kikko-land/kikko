import "./builder-examples";

import { absurdWebBackend } from "@trong-orm/absurd-web-backend";
import {
  DbProvider,
  EnsureDbLoaded,
  IInitDbClientConfig,
  migrationsPlugin,
  reactiveQueriesPlugin,
} from "@trong-orm/react";
import absurdSqlWasmUrl from "@trong-orm/sql.js/dist/sql-wasm.wasm?url";
import { waSqliteWebBackend } from "@trong-orm/wa-sqlite-web-backend";
import { createContext, useMemo, useState } from "react";
import sqlWasmUrl from "wa-sqlite/dist/wa-sqlite-async.wasm?url";

import { List } from "./List";
import { createNotesTableMigration } from "./migrations/createNotesTable";

const buildConfig = (config: IBackendConfig): IInitDbClientConfig => ({
  dbName: "helloWorld",
  dbBackend:
    config.type === "absurd"
      ? absurdWebBackend({
          wasmUrl: absurdSqlWasmUrl,
          pageSize: 32 * 1024,
          cacheSize: -5000,
        })
      : waSqliteWebBackend({
          wasmUrl: sqlWasmUrl,
          pageSize: 32 * 1024,
          cacheSize: -5000,
        }),
  plugins: [
    migrationsPlugin({ migrations: [createNotesTableMigration] }),
    reactiveQueriesPlugin(),
  ],
});

export type IBackendConfig =
  | { type: "absurd" }
  | { type: "wa-sqlite"; vfs: "atomic" | "batchAtomic" };

const defaultConfig: IBackendConfig = {
  type: "wa-sqlite",
  vfs: "atomic",
};

export const BackendConfigContext = createContext<{
  backendConfig: IBackendConfig;
  setBackendConfig: (val: IBackendConfig) => void;
}>({
  backendConfig: defaultConfig,
  setBackendConfig: () => {
    throw new Error("Context is not mounted at top");
  },
});

export const App = () => {
  const [backendConfig, setBackendConfig] = useState<IBackendConfig>({
    type: "wa-sqlite",
    vfs: "atomic",
  });

  const config = useMemo(() => {
    return buildConfig(backendConfig);
  }, [backendConfig]);

  const valForContext = useMemo(() => {
    return { backendConfig, setBackendConfig };
  }, [backendConfig]);

  return (
    <BackendConfigContext.Provider value={valForContext}>
      <DbProvider config={config}>
        <EnsureDbLoaded fallback={<div>Loading db...</div>}>
          <List />
        </EnsureDbLoaded>
      </DbProvider>
    </BackendConfigContext.Provider>
  );
};
