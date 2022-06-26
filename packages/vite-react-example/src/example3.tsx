import { absurdWebBackend } from "@trong-orm/absurd-web-backend";
import {
  deleteFrom,
  in$,
  insert,
  select,
  sql,
  update,
  values,
} from "@trong-orm/query-builder";
import {
  IMigration,
  listenQueries,
  runQueries,
  runQuery,
  useDb,
  useQuery,
  useQueryFirstRow,
  useRunQuery,
} from "@trong-orm/react";
import {
  IInitDbClientConfig,
  migrationsPlugin,
  reactiveQueriesPlugin,
} from "@trong-orm/react";
// For Vite:
import sqlWasmUrl from "@trong-orm/sql.js/dist/sql-wasm.wasm?url";
import { useCallback } from "react";

type IRow = {
  id: string;
  title: string;
};

type IComment = {
  id: string;
  message: string;
};

const notesTable = sql.table("notes");
const commentsTable = sql.table("comments");

const List = () => {
  const result = useQuery<IRow>(select().from(notesTable));

  return result.type === "loaded"
    ? result.data.map((row) => <div key={row.id}>Title: {row.title}</div>)
    : "Loading...";
};

const Note = ({ id }: { id: string }) => {
  // It will returns only first row from the set
  const result = useQueryFirstRow<IRow>(
    select().from(notesTable).where({ id: id })
  );

  // It also support falsy values, so you can wait when further data will appear:
  const commentsResult = useQuery<IComment>(
    result.data &&
      select().from(commentsTable).where({ noteId: result.data.id })
  );

  return result.type === "loaded" ? (
    <div>
      Title: {result.data.title}
      <br />
      Comments:
      <br />
      {commentsResult.data.map((com) => (
        <div id={com.id}>{com.message}</div>
      ))}
    </div>
  ) : (
    "Loading..."
  );
};

const Component = () => {
  // Or you can use `useDbStrict`, it will throw exception if DB not initialized
  const db = useDb();

  const exec = async () => {
    if (!db) return;

    await runQuery(db, select().from("notes"));
  };
};
// For CRA:
// import sqlWasmUrl from "@trong-orm/sql.js/dist/sql-wasm.wasm";

const createNotesTable: IMigration = {
  up: async (db) => {
    const query = sql`
      CREATE TABLE notes (
        id varchar(20) PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_note_title ON notes(title);
    `;

    await runQuery(db, query);
  },
  id: 1653668686076, // id should be uniq
  name: "createNotesTable",
};

const config: IInitDbClientConfig = {
  dbName: "db-name",
  dbBackend: absurdWebBackend({
    wasmUrl: sqlWasmUrl,
  }),
  plugins: [
    migrationsPlugin({ migrations: [createNotesTable] }),
    reactiveQueriesPlugin(),
  ],
};

const Component2 = () => {
  const [createRow, _createState] = useRunQuery((data: IRow) => async (db) => {
    await runQuery(db, insert(data).into(notesTable));
  });

  const [updateRow, _updateState] = useRunQuery(
    (data: Partial<IRow> & { id: string }) => async (db) => {
      await runQuery(db, update(notesTable).set(data).where({ id: data.id }));
    }
  );

  const [deleteRow, _deleteState] = useRunQuery((id: string) => async (db) => {
    await runQuery(db, deleteFrom(notesTable).where({ id }));
  });

  const run = useCallback(async () => {
    const row = { id: "123", title: "HEY!" };

    await createRow(row);
    await updateRow({ ...row, title: "updated" });
    await deleteRow(row.id);
  }, [createRow, deleteRow, updateRow]);

  return <button onClick={run}>Run</button>;
};

const queries = [select().from(notesTable)];

// subscribeToQueries(db, queries).subscribe((res) => {
//   console.log("Queries result: ", res);
// });

deleteFrom("notes")
  .with({
    table: "people_cte",
    columns: ["name", "id"],
    select: values(["Andrew", 1], ["Dima", 2], ["Sergey", 3]),
  })
  .where({ id: in$(select("id").from("people_cte")) })
  .returning("*");

update("inventory")
  .orReplace()
  .with({
    table: "people_cte",
    columns: ["name", "id"],
    select: values(["Andrew", 1], ["Dima", 2], ["Sergey", 3]),
  })
  .set({ quantity: sql`quantity - daily.amt` })
  .from(
    select({ amt: sql`SUM(quantity)` }, "itemId")
      .from("sales")
      .groupBy(sql`2`)
  )
  .where({
    "inventory.itemId": sql`daily.itemId`,
  })
  .returning("*");
