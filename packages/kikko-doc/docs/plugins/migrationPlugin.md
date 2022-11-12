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

## Migration types

There are two types of migration plugin - usual and atomic. The difference is that with usual transaction queries will run in long living transaction, while with atomic all queries will be collected and executed at once.

We recommend to use atomic migrations plugin, but at some cases usual migration plugin could be useful too.

Also, each transaction has ID. We recommend to set ID as `new Date().getTime()` to avoid conflicts with other migrations from other developers. Furthermore, migrations will run sorted by this ID.

This plugin will make sure that all migrations are run before resolving `initDbClient` promise. It will create `migrations` table to keep information about which migrations are already executed.

## Atomic migrations

```ts
const createNotesTableMigration: IAtomicMigration = {
  up: async (tr, db) => {
    tr.addQuery(
      sql`
      CREATE TABLE IF NOT EXISTS notes (
        id varchar(20) PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL
      );`
    );
    
    // You can also run async functions inside of atomic migration
    await new Promise((resolve) => {
      setTimeout(() => resolve(), 2000);
    });
    
    // You can also select some rows inside of migration
    // This query will not run inside of migration transaction
    const comments = await db.runQuery(sql`SELECT * FROM comments`);

    tr.addQuery(
      sql`CREATE INDEX IF NOT EXISTS idx_note_title ON notes(title);`
    );
  },
  id: 1653668686076,
  name: "createNotesTable",
};
```

And add this plugin to initDb and specify migrations you made:

```ts
const db = await initDbClient({
  ...
  plugins: [atomicMigrationsPlugin({ migrations: [createNotesTableMigration] })],
});
```


## Usual migrations

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
  ...
  plugins: [migrationsPlugin({ migrations: [createNotesTableMigration] })],
});
```
