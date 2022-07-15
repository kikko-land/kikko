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
import { useMemo } from "react";
import { useSearchParam } from "react-use";
import sqlWasmUrl from "wa-sqlite/dist/wa-sqlite-async.wasm?url";

import { List } from "./List";
import { createNotesTableMigration } from "./migrations/createNotesTable";

const buildConfig = (config: IBackendConfig): IInitDbClientConfig => {
  return {
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
            vfs: config.vfs,
          }),
    plugins: [
      migrationsPlugin({ migrations: [createNotesTableMigration] }),
      reactiveQueriesPlugin(),
    ],
  };
};

export type IBackendConfig =
  | { type: "absurd" }
  | { type: "wa-sqlite"; vfs: "atomic" | "batch-atomic" | "minimal" };

export const backendOptions = {
  absurd: { type: "absurd" },
  waMinimal: {
    type: "wa-sqlite",
    vfs: "minimal",
  },
} as const;

export const App = () => {
  const backendName = (useSearchParam("backend") ||
    "waMinimal") as keyof typeof backendOptions;

  const config = useMemo(() => {
    return buildConfig(backendOptions[backendName || "waMinimal"]);
  }, [backendName]);

  return (
    <DbProvider config={config}>
      <EnsureDbLoaded fallback={<div>Loading db...</div>}>
        <List />
      </EnsureDbLoaded>
    </DbProvider>
  );
};
