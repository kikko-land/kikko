import { createRecords, modify, read, runQuery, sql } from "@anlamli/orm";
import { useRecords, useRunQuery } from "@anlamli/react-hooks";
import { faker } from "@faker-js/faker";
import { nanoid } from "nanoid";

interface IRecord {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

// interface IRecordManager<R, D> {
//   mapper: {
//     toRow: (r: R) => D;
//     toRecord: (d: D) => R;
//   };
//   middlewares: ((
//     actions:
//       | { type: "create"; id: string; data: D }
//       | { type: "update"; id: string; data: Partial<D> }
//       | { type: "delete"; id: string }
//   ) => Promise<void>)[];
// }

// const createRecordManager = () => {};

export const List = () => {
  const records = useRecords<IRecord>(sql`SELECT * FROM ${read("notes")}`);

  const [createNote, createState] = useRunQuery(async (db) => {
    await createRecords<IRecord>(
      db,
      "notes",
      Array.from(Array(1000).keys()).map((i) => ({
        id: nanoid(),
        title: faker.lorem.words(4),
        content: faker.lorem.paragraph(),
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
      }))
    );
  });

  const [deleteAll, deleteAllState] = useRunQuery(async (db) => {
    await runQuery(db, sql`DELETE FROM ${modify("notes")}`);
  });

  return (
    <>
      <table>
        <thead>
          <tr>
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
                <td>{r.title}</td>
                <td>{r.content}</td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{new Date(r.updatedAt).toLocaleString()}</td>
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
