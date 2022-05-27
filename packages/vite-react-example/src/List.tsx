import { createRecord, modify, read, runQuery, sql } from "@anlamli/orm";
import { useRecords, useRunQuery } from "@anlamli/react-hooks";
import { nanoid } from "nanoid";

interface IRecord {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export const List = () => {
  const records = useRecords<IRecord>(sql`SELECT * FROM ${read("notes")}`);

  const [createNote, createState] = useRunQuery(async (db) => {
    await createRecord<IRecord>(db, "notes", {
      id: nanoid(),
      title: "hi!",
      content: "Hello world!",
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });
  });

  const [deleteAll, deleteAllState] = useRunQuery(async (db) => {
    await runQuery(db, sql`DELETE FROM ${modify("notes")}`);
  });

  return (
    <>
      <table>
        <thead>
          <tr>
            <td>ID</td>
            <td>Title</td>
            <td>Content</td>
            <td>Created At</td>
            <td>Updated At</td>
          </tr>
        </thead>
        <tbody>
          {records.type === "loaded" &&
            records.data.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.title}</td>
                <td>{r.content}</td>
                <td>{r.createdAt}</td>
                <td>{r.updatedAt}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <button
        onClick={createNote}
        disabled={
          createState.type === "loading" || createState.type === "waitingDb"
        }
      >
        {createState.type === "loading" ? "Loading..." : "Add record!"}
      </button>

      <button
        onClick={deleteAll}
        disabled={
          deleteAllState.type === "loading" ||
          deleteAllState.type === "waitingDb"
        }
      >
        {deleteAllState.type === "loading"
          ? "Loading..."
          : "Delete all records!"}
      </button>
    </>
  );
};
