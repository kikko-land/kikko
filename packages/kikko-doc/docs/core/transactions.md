---
sidebar_position: 2
slug: /core/transactions
---

# Transactions

:::info
During transaction all other queries that run not in transaction will be queued. So to avoid
timeout of those queries make sure that your transactions run as fast as possible. So we recommend
to run all time-consuming work before transaction start.
:::

## Running in transaction

```typescript
await db.transaction(async (db) => {
  await db.runQuery(deleteFrom("comments"));
  await db.runQuery(deleteFrom("notes"));
});
```

Transaction will rollback if any error will be thrown during.

## Nesting

It also supports nesting:

```typescript
await transaction(async (db) => {
  await db.runQuery(deleteFrom("comments"));
  await db.transaction(async (db) => {
    await db.runQuery(deleteFrom("notes"));
  });
});
```

Nested transaction will be merged to the parent transaction. It is also planned to add support
for `SAVEPOINT` and `RELEASE` commands, so nested transaction will run isolated.

## After transaction callbacks

You could also register callback that will run once transaction will be finished or rollbacked:

```typescript
await db.transaction(async (db) => {
  await db.runQuery(deleteFrom("comments"));

  runAfterTransactionCommitted(db, () => {
    console.log("All comments are deleted!");
  });

  runAfterTransactionRollbacked(db, () => {
    console.log("Failed to delete comments");
  });
});
```

Note that callbacks will run **AFTER** transaction `COMMIT` or `ROLLBACK`. It especially helpful when you need
to notify other components that they can read from DB inserted values.

## Transaction modes

By default transaction will run in DEFERRED mode. If you need other modes use:

```typescript
// DEFERRED
db.transaction((db) => {}, {type: "deffered"});

// IMMEDIATE
db.transaction((db) => {}, {type: "immediate"});

// EXCLUSIVE
db.transaction((db) => {}, {type: "exclusive"});
```

For more information read https://www.sqlite.org/lang_transaction.html#deferred_immediate_and_exclusive_transactions
