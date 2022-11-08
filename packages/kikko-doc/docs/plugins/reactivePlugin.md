import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

# Reactive queries plugin

## Installation And Usage

Install it:

<Tabs>
  <TabItem value="yarn" label="yarn" default>

```bash
yarn add @kikko-land/reactive-queries-plugin
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm i -S @kikko-land/reactive-queries-plugin
```

  </TabItem>
</Tabs>

Add this plugin to initDb:

```ts
const db = await initDbClient({
  dbName: "helloWorld4",
  dbBackend: absurdWebBackend({
    wasmUrl: "https://kikko-doc.netlify.app/wasm/sql-wasm.wasm",
  }),
  plugins: [reactiveQueriesPlugin()],
});
```

And then listen your queries:

```typescript
const unsubscribe = listenQueries(db, [select().from("notes")], (res) => {
  console.log("Queries result: ", res);
});

// You can also unsubscribe lately
setTimeout(() => {
  unsubscribe();
}, 1000);
```

CodeSandbox example:

<iframe src="https://codesandbox.io/embed/kikko-typescript-example-t1v4ut?fontsize=14&hidenavigation=1&theme=dark&view=editor"
     style={{"width":"100%", "height": "500px", border: "0", "border-radius": "4px", "overflow": "hidden"}}
     title="Kikko typescript example"
     allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
     sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
   ></iframe>

## How reactivity works

This plugin gathers information about which tables are used when you build queries.

Like:

```typescript
console.log(
  sql`SELECT * FROM ${sql.table`notes`} WHERE id = (SELECT noteId FROM ${
    sql.table`comments`
  )} LIMIT 1)`.tables.map(({ name }) => name)
);
// => ["notes", "comments"]
```

`reactive-plugin` will hook on each query run
and determine if read or write query will be executed by SQLite.
When write query finished executing, `reactive-plugin` will notify all other tabs (using [broadcast-channel](https://github.com/pubkey/broadcast-channel)) which tables were changed.
Then all queries that are subscribed to changed tables will be notified.
