---
sidebar_position: 3
slug: /react-integration/hooks
---

# Hooks

## useDbQuery / useFirstRowDbQuery

Usage example:

TODO

About how to build complex queries please refer to [query builder doc](/building-sql/query-builder).

## useRunDbQuery

Usage example:

```tsx
type IRow = {
  id: string;
  title: string;
};

const notesTable = sql.table("notes");

const RunComponent = () => {
  const [createRow, _createState] = useRunDbQuery((db) => async (data: IRow) => {
    await runQuery(db, insert(data).into(notesTable));
  });

  const [updateRow, _updateState] = useRunDbQuery(
    (db) => async (data: Partial<IRow> & { id: string }) => {
      await runQuery(db, update(notesTable).set(data).where({ id: data.id }));
    }
  );

  const run = useCallback(async () => {
    const row = { id: "123", title: "HEY!" };

    await createRow(row);
    await updateRow({ ...row, title: "updated" });
  }, [createRow, updateRow]);

  return <button onClick={run}>Run</button>;
};
```

:::info
By default all queries in `useRunDbQuery` will run in transaction. You can disable it in the second argument with `{ inTransaction?: boolean }`.
:::

## useDb / useDbStrict

```typescript
const Component = () => {
  // Or you can use `useDbStrict`, it will throw exception if DB not initialized
  const db = useDb();

  const exec = async () => {
    if (!db) return;

    await db.runQuery(select().from("notes"));
  };
};
```

This hook is used internally, but you still can access db
if you need. Usually you need `useDbQuery`/`useRunDbQuery` to run queries.
