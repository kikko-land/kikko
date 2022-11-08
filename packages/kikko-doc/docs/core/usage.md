---
sidebar_position: 1
slug: /core/usage
---

# Init, run and listen queries

You can use `kikko` without react or any other libs integrations.

Here is CodeSandbox with examples:

<iframe
  src="https://codesandbox.io/embed/epic-shape-t1v4ut?expanddevtools=1&fontsize=14&hidenavigation=1&theme=dark"
  style={{
    width: "100%",
    height: "500px",
    border: "0",
    borderRadius: "4px",
    overflow: "hidden",
  }}
  title="epic-shape-t1v4ut"
  allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
  sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>

## Init Kikko

```typescript
const db = await initDbClient({
  dbName: "helloWorld4",
  dbBackend: absurdWebBackend({
    wasmUrl: "https://kikko-doc.netlify.app/wasm/sql-wasm.wasm",
  }),
  plugins: [
    // migrationsPlugin({ migrations: [] }), // Uncomment if you need migration support
    // reactiveQueriesPlugin() // Uncomment if you want to use listenQueries()
  ],
});
```

## Run queries

```typescript
// One query
const title = 'title';
const content = 'content';
const title2 = 'title2';
const content2 = 'content2';

await db.runQuery(
  sql`INSERT INTO notes(id, title) VALUES(${title}, ${content})`
);

// Multiple queries

await db.runQueries([
  sql`INSERT INTO notes(id, title) VALUES(${title}, ${content})`,
  sql`INSERT INTO notes(id, title) VALUES(${title2}, ${content2})`
]);

// You can also suppress log

await withSuppressedLog(db).runQueries([
  sql`INSERT INTO notes(id, title) VALUES(${title}, ${content})`,
  sql`INSERT INTO notes(id, title) VALUES(${title2}, ${content2})`
]);

// Even with transaction

await withSuppressedLog(db).transaction(async (db) => {
  await db.runQueries([
    sql`INSERT INTO notes(id, title) VALUES(${title}, ${content})`,
    sql`INSERT INTO notes(id, title) VALUES(${title2}, ${content2})`
  ]);

  db.runAfterTransactionCommitted(() => {
    console.log("Notes created!");
  });
});
```

## Listen queries

You must use `react-queries-plugin` to be able to listen queries.

Here is how you can listen changes in tables:

```typescript
const unsubscribe = listenQueries(db, [select().from("notes")], (res) => {
  console.log("Queries result: ", res);
});

// You can also unsubscribe
setTimeout(() => {
  unsubscribe();
}, 1000);
```
