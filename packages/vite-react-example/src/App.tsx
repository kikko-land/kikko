import { IInitDbConfig } from "@trong/orm";
import DbWorker from "@trong/orm/src/worker/DB.worker?worker";
import { DbProvider, EnsureDbLoaded } from "@trong/react-hooks";
import sqlWasmUrl from "@harika-org/sql.js/dist/sql-wasm.wasm?url";

import { List } from "./List";
import { createNotesTableMigration } from "./migrations/createNotesTable";

const config: IInitDbConfig = {
  dbName: "helloWorld",
  worker: new DbWorker(),
  wasmUrl: sqlWasmUrl,
  migrations: [createNotesTableMigration],
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
