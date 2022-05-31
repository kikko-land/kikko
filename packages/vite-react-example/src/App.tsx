import sqlWasmUrl from "@harika-org/sql.js/dist/sql-wasm.wasm?url";
import { IInitDbConfig, migrationPlugin } from "@trong/core";
import DbWorker from "@trong/core/src/worker/DB.worker?worker";
import { DbProvider, EnsureDbLoaded } from "@trong/react-hooks";
import { reactiveQueriesPlugin } from "@trong/reactive-queries";

import { List } from "./List";
import { createNotesTableMigration } from "./migrations/createNotesTable";

const config: IInitDbConfig = {
  dbName: "helloWorld",
  worker: new DbWorker(),
  wasmUrl: sqlWasmUrl,
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
