---
sidebar_position: 3
slug: /react-integration/hooks
---

# Hooks

## useDbQuery / useFirstRowDbQuery

Usage example:

TODO

## useRunDbQuery

Usage example:

```tsx
type IRow = {
  id: string;
  title: string;
};

const notesTable = sql.table("notes");

const RunComponent = () => {
  const [createRow, _createState] = useRunDbQuery(
    (db) => async (data: IRow) => {
      await runQuery(
        db,
        sql`INSERT INTO ${notesTable}(id, title) VALUES(${data.id}, ${data.title})`
      );
    }
  );

  const [updateRow, _updateState] = useRunDbQuery(
    (db) => async (data: Partial<IRow> & { id: string }) => {
      await runQuery(
        db,
        sql`UPDATE ${notesTable} SET id=${data.id}, title=${data.title} WHERE id=${data.id}`
      );
    }
  );

  const run = useCallback(async () => {
    const row = { id: "123", title: "HEY!" };

    await runQuery(
      db,
      sql`INSERT INTO ${notesTable}(id, title) VALUES(${row.id}, ${row.title})`
    );

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

    await db.runQuery(sql`SELECT * FROM ${sql.table`notes`}`);
  };
};
```

This hook is used internally, but you still can access db
if you need. Usually you need `useDbQuery`/`useRunDbQuery` to run queries.
