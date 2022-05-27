import { createRecord, createRecords, readFrom, sql } from "@anlamli/orm";
import { useRecords, useRunQuery } from "@anlamli/react-hooks";
import { nanoid } from "nanoid";
import { useCallback } from "react";

interface IRecord {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export const List = () => {
  const records = useRecords<IRecord>(sql`SELECT * FROM ${readFrom("notes")}`);

  const [run, state] = useRunQuery(
    useCallback(async (db) => {
      await createRecord<IRecord>(db, "notes", {
        id: nanoid(),
        title: "hi!",
        content: "Hello world!",
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
      });
    }, [])
  );

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
        onClick={run}
        disabled={state.type === "loading" || state.type === "waitingDb"}
      >
        {state.type === "loading" ? "Loading..." : "Add record!"}
      </button>
    </>
  );
};
