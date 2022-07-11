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

// import { waSqliteWebBackend } from "@trong-orm/wa-sqlite-web-backend";
// import sqlWasmUrl from "wa-sqlite/dist/wa-sqlite-async.wasm?url";
import { List } from "./List";
import { createNotesTableMigration } from "./migrations/createNotesTable";

const config: IInitDbClientConfig = {
  dbName: "helloWorld",
  dbBackend: absurdWebBackend({
    wasmUrl: absurdSqlWasmUrl,
    pageSize: 32 * 1024,
    cacheSize: -5000,
  }),
  // dbBackend: waSqliteWebBackend({ wasmUrl: sqlWasmUrl }),
  plugins: [
    migrationsPlugin({ migrations: [createNotesTableMigration] }),
    reactiveQueriesPlugin(),
  ],
};

export const App = () => {
  return (
    <DbProvider config={config}>
      <EnsureDbLoaded fallback={<div>Loading db...</div>}>
        <List />
      </EnsureDbLoaded>
    </DbProvider>
  );
};
