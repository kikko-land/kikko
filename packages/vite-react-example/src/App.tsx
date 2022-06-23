import "./builder-examples";

import {
  DbProvider,
  EnsureDbLoaded,
  IInitDbClientConfig,
  initAbsurdWebBackend,
  migrationPlugin,
  reactiveQueriesPlugin,
} from "@trong-orm/react";
import sqlWasmUrl from "@trong-orm/sql.js/dist/sql-wasm.wasm?url";
import React from "react";

import { List } from "./List";
import { createNotesTableMigration } from "./migrations/createNotesTable";

const config: IInitDbClientConfig = {
  dbName: "helloWorld",
  dbBackend: initAbsurdWebBackend({
    wasmUrl: sqlWasmUrl,
  }),
  plugins: [
    migrationPlugin([createNotesTableMigration]),
    reactiveQueriesPlugin,
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
