import { initAbsurdWebBackend } from "@trong-orm/absurd-web-backend";
import DbWorker from "@trong-orm/absurd-web-backend/src/worker/DB.worker?worker";
import { IInitDbClientConfig, migrationPlugin } from "@trong-orm/core";
import { DbProvider, EnsureDbLoaded } from "@trong-orm/react-queries-hooks";
import { reactiveQueriesPlugin } from "@trong-orm/reactive-queries-plugin";
import sqlWasmUrl from "@trong-orm/sql.js/dist/sql-wasm.wasm?url";
import React from "react";

import { List } from "./List";
import { createNotesTableMigration } from "./migrations/createNotesTable";

const config: IInitDbClientConfig = {
  dbName: "helloWorld",
  dbBackend: initAbsurdWebBackend({
    worker: () => new DbWorker(),
    wasmUrl: sqlWasmUrl,
  }),
  plugins: [
    migrationPlugin([createNotesTableMigration]),
    reactiveQueriesPlugin,
  ],
};

export const App = () => {
  return (
    <React.StrictMode>
      <DbProvider config={config}>
        <EnsureDbLoaded fallback={<div>Loading db...</div>}>
          <List />
        </EnsureDbLoaded>
      </DbProvider>
    </React.StrictMode>
  );
};
