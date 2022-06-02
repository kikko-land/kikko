import { IInitDbConfig, migrationPlugin } from "@trong-orm/core";
import DbWorker from "@trong-orm/core/src/worker/DB.worker?worker";
import { DbProvider, EnsureDbLoaded } from "@trong-orm/react-queries-hooks";
import { reactiveQueriesPlugin } from "@trong-orm/reactive-queries";
import sqlWasmUrl from "@trong-orm/sql.js/dist/sql-wasm.wasm?url";

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
