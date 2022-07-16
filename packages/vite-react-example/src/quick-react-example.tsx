import { absurdWebBackend } from "@trong-orm/absurd-web-backend";
import {
  DbProvider,
  EnsureDbLoaded,
  IInitDbClientConfig,
  IMigration,
  migrationsPlugin,
  reactiveQueriesPlugin,
  runQuery,
  sql,
} from "@trong-orm/react";
// For Vite:
import sqlWasmUrl from "@trong-orm/sql.js/dist/sql-wasm.wasm?url";

import { List } from "./list/List";

const createNotesTable: IMigration = {
  up: async (db) => {
    await runQuery(
      db,
      sql`
      CREATE TABLE IF NOT EXISTS notes (
        id varchar(20) PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
      );
    `
    );

    await runQuery(
      db,
      sql`
      CREATE INDEX IF NOT EXISTS idx_note_title ON notes(title);
    `
    );
  },
  id: 1653668686076,
  name: "createNotesTable",
};

const config: IInitDbClientConfig = {
  dbName: "quick-example-db",
  dbBackend: absurdWebBackend({
    wasmUrl: sqlWasmUrl,
  }),
  plugins: [
    migrationsPlugin({ migrations: [createNotesTable] }),
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
