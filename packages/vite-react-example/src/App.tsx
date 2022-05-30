import sqlWasmUrl from "@harika-org/sql.js/dist/sql-wasm.wasm?url";
import { IInitDbConfig, migrationPlugin } from "@trong/orm";
import DbWorker from "@trong/orm/src/worker/DB.worker?worker";
import { DbProvider, EnsureDbLoaded } from "@trong/react-hooks";

import { List } from "./List";
import { createNotesTableMigration } from "./migrations/createNotesTable";

const config: IInitDbConfig = {
  dbName: "helloWorld",
  worker: new DbWorker(),
  wasmUrl: sqlWasmUrl,
  plugins: [migrationPlugin([createNotesTableMigration])],
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
