---
sidebar_position: 3
slug: /how-reactivity-works
---

# How reactivity works

Kikko gathers infomration about which tables are used when you build raw queries or with query-builder.

Like:

```typescript
console.log(
  select()
    .from("notes")
    .where({ ids: select("comments.noteId").from("comments") })
    .toSql()
    .tables.map(({ name }) => name)
);
// => ["notes", "comments"]

console.log(
  insert({ title: "Note Title" })
    .into("notes")
    .toSql()
    .tables.map(({ name }) => name)
);
// => ["notes"]
```

For raw queries, you need to use `sql.table('table_name')` helper:

```typescript
const notesTable = sql.table("notes");

console.log(
  sql`SELECT * FROM ${notesTable} WHERE id = (SELECT noteId FROM ${sql.table(
    "comments"
  )} LIMIT 1)`.tables.map(({ name }) => name)
);
// => ["notes", "comments"]
```

`reactive-plugin` will hook on each query run and determine if read or write query will be executed by SQLite.
When write query finished executing, `reactive-plugin` will notify all other tabs (using [broadcast-channel](https://github.com/pubkey/broadcast-channel)) which tables were changed.
Then all queries that are subscribed to changed tables will be notified.
