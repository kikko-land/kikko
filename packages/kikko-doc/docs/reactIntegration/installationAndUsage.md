---
sidebar_position: 1
slug: /react-integration/installation
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

# Installation And Usage

Install core packages:

<Tabs>
  <TabItem value="yarn" label="yarn" default>

```bash
yarn add @kikko-land/react
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm i -S @kikko-land/react
```

  </TabItem>
</Tabs>

You also need to install and configure SQLite backend you need. Please, checkout [backend section](/backends/web) in the doc for more info.

After wrap the whole app with this components(usage example for vite web):

```tsx
import { absurdWebBackend } from "@kikko-land/absurd-web-backend";
import { DbProvider, EnsureDbLoaded } from "@kikko-land/react";
import sqlWasmUrl from "@kikko-land/sql.js/dist/sql-wasm.wasm?url";

const createNotesTableMigration: IMigration = {
  up: async (db) => {
    await db.runQuery(
      sql`CREATE TABLE notes (id varchar(20) PRIMARY KEY, title TEXT NOT NULL);`
    );
  },
  id: 18,
  name: "createNotesTable",
};

const config: IInitDbClientConfig = {
  dbName: "db-name",
  dbBackend: absurdWebBackend({
    wasmUrl: sqlWasmUrl,
  }),
  plugins: [
    migrationsPlugin({ migrations: [createNotesTableMigration] }),
    reactiveQueriesPlugin(),
  ],
};

export const App = () => (
  <DbsHolder defaultDbConfig={config}>
    <EnsureDbLoaded fallback={<div>Loading db...</div>}>
      <Notes />
    </EnsureDbLoaded>
  </DbsHolder>
);
```

Then use it in your child components:

```tsx
import {
  useDbQuery,
  useFirstRowDbQuery,
  useRunDbQuery,
  makeId,
  runQuery,
  sql
} from "@kikko-land/react";

type Note = { id: string; title: string };
const notesTable = sql.table`notes`;

export const Notes = () => {
  const notes = useDbQuery<Note>(sql`SELECT * FROM ${notesTable}`);
  const notesCount = useFirstRowDbQuery<{ count: number }>(
    sql`SELECT COUNT(*) FROM ${notesTable}`
  );

  const addNote = useRunDbQuery((db) => async () => {
    const id = makeId();

    await db.runQuery(
      sql`INSERT INTO ${notesTable}(id, title) VALUES(${id}, ${`Note#${id}`})`
    );
  });

  return (
    <>
      <button onClick={addNote}>Add note</button>
      <div>Add note result: {addNote.state.value}</div>
      <div>Query result (total notes count: {notesCount.data?.count})</div>
      <pre>{JSON.stringify(notes)}</pre>
    </>
  );
};
```
