import { faker } from "@faker-js/faker";
import {
  deleteFrom,
  insert,
  like$,
  select,
  update,
} from "@trong-orm/query-builder";
import {
  makeId,
  runQuery,
  sql,
  useCacheQuery,
  useQuery,
  useRunQuery,
} from "@trong-orm/react";
import { chunk } from "lodash-es";
import { useState } from "react";
import Highlighter from "react-highlight-words";

import { usePaginator } from "./hooks/usePaginator";

type INoteRow = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};
const notesTable = sql.table("notes");

const Row = ({
  row,
  textToSearch,
}: {
  row: INoteRow;
  textToSearch: string;
}) => {
  const [deleteRecord, deleteRecordState] = useRunQuery(() => async (db) => {
    await runQuery(db, deleteFrom(notesTable).where({ id: row.id }));
  });

  const [updateRecord, updateRecordState] = useRunQuery(() => async (db) => {
    await runQuery(
      db,
      update(notesTable)
        .set({
          title: row.title + " updated!",
          content: row.content + " updated!",
        })
        .where({ id: row.id })
    );
  });

  return (
    <tr key={row.id}>
      <td>{row.title}</td>
      <td>
        <Highlighter
          searchWords={[textToSearch]}
          autoEscape={true}
          textToHighlight={row.content}
        />
      </td>
      <td>{new Date(row.createdAt).toLocaleString()}</td>
      <td>{new Date(row.updatedAt).toLocaleString()}</td>
      <td>
        <button
          onClick={() => deleteRecord()}
          disabled={deleteRecordState.type !== "idle"}
        >
          Delete
        </button>
        <button
          onClick={() => updateRecord()}
          disabled={
            updateRecordState.type !== "running" &&
            updateRecordState.type !== "idle" &&
            updateRecordState.type !== "done"
          }
        >
          Update {updateRecordState.type}
        </button>
      </td>
    </tr>
  );
};

export const List = () => {
  const [textToSearch, setTextToSearch] = useState<string>("");

  const baseSql = useCacheQuery(
    select()
      .from(notesTable)
      .where(
        textToSearch ? { content: like$("%" + textToSearch + "%") } : sql.empty
      )
  );

  const {
    paginatedQuery,
    totalPages,
    currentPage,
    totalCount,
    isNextPageAvailable,
    isPrevPageAvailable,
    nextPage,
    prevPage,
  } = usePaginator({
    perPage: 50,
    baseQuery: baseSql,
  });
  const rowsResult = useQuery<INoteRow>(paginatedQuery);

  const [createNotes, createNotesState] = useRunQuery(
    (count: number) => async (db) => {
      for (const ch of chunk(Array.from(Array(count).keys()), 3000)) {
        await runQuery(
          db,
          insert(
            ch.map((i) => ({
              id: makeId(),
              title: faker.lorem.words(4),
              content: faker.lorem.paragraph(),
              createdAt: new Date().getTime(),
              updatedAt: new Date().getTime(),
            }))
          ).into(notesTable)
        );
      }
    }
  );

  const [deleteAll, deleteAllState] = useRunQuery(() => async (db) => {
    await runQuery(db, deleteFrom(notesTable));
  });

  return (
    <>
      {[100, 1000, 10_000].map((count) => (
        <button
          key={count}
          onClick={() => createNotes(count)}
          disabled={
            createNotesState.type === "running" ||
            createNotesState.type === "waitingDb"
          }
        >
          {createNotesState.type === "running"
            ? "Loading..."
            : `Add  ${count} records!`}
        </button>
      ))}

      <button
        onClick={deleteAll}
        disabled={
          deleteAllState.type === "running" ||
          deleteAllState.type === "waitingDb"
        }
      >
        {deleteAllState.type === "running"
          ? "Loading..."
          : "Delete all records!"}
      </button>

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
      <br />

      <div>
        Total found records:{" "}
        {totalCount !== undefined ? totalCount : "Loading..."}
      </div>

      <br />

      <table>
        <thead>
          <tr>
            <td>Title</td>
            <td>Content</td>
            <td>Created At</td>
            <td>Updated At</td>
            <td>Actions</td>
          </tr>
        </thead>
        <tbody>
          {rowsResult.type === "loaded" &&
            rowsResult.data.map((r) => (
              <Row row={r} textToSearch={textToSearch} key={r.id} />
            ))}
        </tbody>
      </table>

      <br />

      <div>
        Page: {currentPage}
        {totalPages !== undefined && ` of ${totalPages}`}
        <button disabled={!isPrevPageAvailable} onClick={prevPage}>
          Prev page
        </button>
        <button disabled={!isNextPageAvailable} onClick={nextPage}>
          Next page
        </button>
      </div>
    </>
  );
};
