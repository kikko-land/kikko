import {
  createRecordConfig,
  createRecords,
  modify,
  read,
  runQuery,
  sql,
} from "@anlamli/orm";
import { useRecords, useRunQuery } from "@anlamli/react-hooks";
import { faker } from "@faker-js/faker";
import { nanoid } from "nanoid";

interface IRow {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

interface IRecord {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const notesRecords = createRecordConfig<IRow, IRecord>({
  table: "notes",
  serialize: (record) => ({
    ...record,
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  }),
  deserialize: (row) => ({
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }),
  middlewares: [
    async (dbState, recordConfig, actions, next) => {
      const res = await next(dbState, recordConfig, actions);

      return res;
    },
  ],
});

export const List = () => {
  const records = useRecords<IRow>(sql`SELECT * FROM ${read("notes")}`);

  const [createNote, createState] = useRunQuery(async (db) => {
    await createRecords(
      db,
      notesRecords,
      Array.from(Array(2).keys()).map((i) => ({
        id: nanoid(),
        title: faker.lorem.words(4),
        content: faker.lorem.paragraph(),
        createdAt: new Date(),
        updatedAt: new Date(),
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
