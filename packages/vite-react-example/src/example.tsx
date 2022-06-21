import {
  deleteFrom,
  desc,
  insert,
  like$,
  select,
} from "@trong-orm/query-builder";
import {
  runAfterTransactionCommitted,
  runQuery,
  sql,
  table,
  useQuery,
  useQueryFirstRow,
  useRunQuery,
} from "@trong-orm/react";
import { nanoid } from "nanoid";
import { useState } from "react";

const notesTable = table("notes");

export const List = () => {
  const [textToSearch, setTextToSearch] = useState<string>("");

  const baseSql = select()
    .from(notesTable)
    .where(
      textToSearch ? { content: like$("%" + textToSearch + "%") } : sql.empty
    )
    .orderBy(desc("createdAt"));

  const { data: recordsData } = useQuery<{
    id: string;
    title: string;
    content: string;
    createdAt: number;
  }>(baseSql);

  const countResult = useQueryFirstRow<{ count: number }>(
    select({ count: sql`COUNT(*)` }).from(baseSql)
  );

  const [createNote, createNoteState] = useRunQuery(
    ({ title, content }: { title: string; content: string }) =>
      async (db) => {
        const time = new Date().getTime();
        await runQuery(
          db,
          insert({
            id: nanoid(),
            title,
            content,
            updatedAt: time,
            createdAt: time,
          }).into(notesTable)
        );
      }
  );

  const [deleteAll, deleteAllState] = useRunQuery(() => async (db) => {
    await runQuery(db, deleteFrom(notesTable));

    runAfterTransactionCommitted(db, () => {
      console.log("It runs after transaction committed!");
    });
  });

  return (
    <>
      <form
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSubmit={(e: any) => {
          e.preventDefault();
          const title = e.target.title.value;
          const content = e.target.content.value;

          createNote({ title, content });
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
            createNoteState.type === "loading" ||
            createNoteState.type === "waitingDb"
          }
        >
          {createNoteState.type === "loading" ? "Loading..." : "Submit"}
        </button>
      </form>
      <br />
      <button
        type="submit"
        disabled={
          deleteAllState.type === "loading" ||
          deleteAllState.type === "waitingDb"
        }
        onClick={deleteAll}
      >
        {deleteAllState.type === "loading" ? "Loading..." : "Delete all"}
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
