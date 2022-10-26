/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { deleteFrom, desc, insert, like$, select } from "@kikko-land/boono";
import {
  makeId,
  sql,
  useDbQuery,
  useFirstRowDbQuery,
  useRunDbQuery,
} from "@kikko-land/react";
import { useState } from "react";

const notesTable = sql.table("notes");

export const List = () => {
  const [textToSearch, setTextToSearch] = useState<string>("");

  const baseSql = select()
    .from(notesTable)
    .where(
      textToSearch ? { content: like$("%" + textToSearch + "%") } : sql.empty
    )
    .orderBy(desc("createdAt"));

  const { data: recordsData } = useDbQuery<{
    id: string;
    title: string;
    content: string;
    createdAt: number;
  }>(baseSql);

  const countResult = useFirstRowDbQuery<{ count: number }>(
    select({ count: sql`COUNT(*)` }).from(baseSql)
  );

  const [createNote, createNoteState] = useRunDbQuery(
    (db) =>
      async ({ title, content }: { title: string; content: string }) => {
        const time = new Date().getTime();
        await db.runQuery(
          insert({
            id: makeId(),
            title,
            content,
            updatedAt: time,
            createdAt: time,
          }).into(notesTable)
        );
      }
  );

  const [deleteAll, deleteAllState] = useRunDbQuery((db) => async () => {
    await db.runQuery(deleteFrom(notesTable));

    db.runAfterTransactionCommitted(() => {
      console.log("It runs after transaction committed!");
    });
  });

  return (
    <>
      <form
        onSubmit={(e: any) => {
          e.preventDefault();
          const title = e.target.title.value;
          const content = e.target.content.value;

          void createNote({ title, content });
        }}
      >
        <label>
          Title
          <input name="title" required />
        </label>
        <br />
        <br />
        <label>
          Content
          <textarea name="content" required />
        </label>

        <br />
        <br />

        <button
          type="submit"
          disabled={
            createNoteState.type === "running" ||
            createNoteState.type === "waitingDb"
          }
        >
          {createNoteState.type === "running" ? "Loading..." : "Submit"}
        </button>
      </form>
      <br />
      <button
        type="submit"
        disabled={
          deleteAllState.type === "running" ||
          deleteAllState.type === "waitingDb"
        }
        onClick={() => void deleteAll()}
      >
        {deleteAllState.type === "running" ? "Loading..." : "Delete all"}
      </button>
      <hr />
      Total found records:{" "}
      {countResult.data !== undefined ? countResult.data.count : "Loading..."}
      <br />
      <br />
      <input
        value={textToSearch}
        onChange={(e) => {
          setTextToSearch(e.target.value);
        }}
        placeholder="Search content"
      />
      <br />
      {recordsData.map(({ title, content, id, createdAt }) => (
        <div key={id}>
          <h1>{title}</h1>
          <div>Created at: {new Date(createdAt).toISOString()}</div>
          <br />
          <div>Content: {content}</div>
        </div>
      ))}
    </>
  );
};
