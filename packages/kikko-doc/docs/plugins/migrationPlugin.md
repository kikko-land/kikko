import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

# Migration plugin

<Tabs>
  <TabItem value="yarn" label="yarn" default>

```bash
yarn add @kikko-land/migrations-plugin
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm i -S @kikko-land/migrations-plugin
```

  </TabItem>
</Tabs>

Make a migration, for example:

```ts
const createNotesTableMigration: IMigration = {
  up: async (db) => {
    await db.runQuery(
      sql`
      CREATE TABLE IF NOT EXISTS notes (
        id varchar(20) PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL
      );
    `
    );

    await db.runQuery(
      sql`
      CREATE INDEX IF NOT EXISTS idx_note_title ON notes(title);
    `
    );
  },
  id: 1653668686076,
  name: "createNotesTable",
};
```

And add this plugin to initDb and specify migrations you made:

```ts
const db = await initDbClient({
  dbName: "helloWorld4",
  dbBackend: absurdWebBackend({
    wasmUrl: "https://kikko-doc.netlify.app/wasm/sql-wasm.wasm",
  }),
  plugins: [migrationsPlugin({ migrations: [createNotesTableMigration] })],
});
```

Now on each start this plugin will make sure that all migrations are run before
resolving `initDbClient` promise. It will create `migrations` table and for each
migration run it will put the id of the migration to table.
