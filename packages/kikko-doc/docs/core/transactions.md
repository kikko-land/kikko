---
sidebar_position: 2
slug: /core/transactions
---

# Transactions

There are two types of transactions — atomic and usual. The difference is that atomic runs
all queries in single batch, while usual transaction runs queries as they go.

So, if you want to execute query in usual transaction — Kikko will need to send n+2 queries to backend:

1. `BEGIN[send, receive]`
2. `<your-query-1>[send, receive]`
3. `<your-query-2>[send,receive]`
4. `COMMIT[send, receive]`

With atomic transaction only one array of queries will be send,
which will reduce send/receive time and reduce total blocking time of queries queue.

## Atomic transaction

Kikko will collect all the queries from the callback(even if callback is async) and execute all of them at once:

```typescript
await db.runInAtomicTransaction(async (scope) => {
  scope.addQuery(sql`DELETE FROM ${sql.table`comments`}`);

  await new Promise((resolve) => {
    setTimeout(() => resolve(), 2000);
  });

  scope.afterCommit(() => {
    console.log("After commit!");
  });

  scope.afterRollback(() => {
    console.log("After rollback!");
  });

  scope.addQuery(sql`DELETE FROM ${sql.table`notes`}`);
});
```

## Usual Transaction

:::info
During transaction all other queries that run not in transaction will be queued. So to avoid
timeout of those queries make sure that your transactions run as fast as possible. So we recommend
to run all time-consuming work before transaction start.
:::

```typescript
await db.runInTransaction(async (db) => {
  await db.runQuery(sql`DELETE FROM ${sql.table`comments`}`);
  await db.runQuery(sql`DELETE FROM ${sql.table`notes`}`);
});
```

Transaction will rollback if any error will be thrown during.

### Nesting

It also supports nesting:

```typescript
await db.runInTransaction(async (db) => {
  await db.runQuery(sql`DELETE FROM ${sql.table`comments`}`);
  await db.runInTransaction(async (db) => {
    await db.runQuery(sql`DELETE FROM ${sql.table`notes`}`);
  });
});
```

Nested transaction will be merged to the parent transaction. It is also planned to add support
for `SAVEPOINT` and `RELEASE` commands, so nested transaction will run isolated.

### After transaction callbacks

You could also register callback that will run once transaction will be finished or rollbacked:

```typescript
await db.runInTransaction(async (db) => {
  await db.runQuery(sql`DELETE FROM ${sql.table`notes`}`);

  db.runAfterTransactionCommitted(() => {
    console.log("All comments are deleted!");
  });

  db.runAfterTransactionRollbacked(() => {
    console.log("Failed to delete comments");
  });
});
```

Note that callbacks will run **AFTER** transaction `COMMIT` or `ROLLBACK`. It especially helpful when you need
to notify other components that they can read from DB inserted values.

### Transaction modes

By default transaction will run in DEFERRED mode. If you need other modes use:

```typescript
// DEFERRED
db.runInTransaction((db) => {}, { type: "deffered" });

// IMMEDIATE
db.runInTransaction((db) => {}, { type: "immediate" });

// EXCLUSIVE
db.runInTransaction((db) => {}, { type: "exclusive" });
```

For more information read https://www.sqlite.org/lang_transaction.html#deferred_immediate_and_exclusive_transactions
