import "@trong-orm/query-builder";

import { faker } from "@faker-js/faker";
import { runAfterTransactionCommitted } from "@trong-orm/core";
import { useRunQuery, useSql } from "@trong-orm/react-queries-hooks";
import { useRecords } from "@trong-orm/react-records-hooks";
import {
  createRecords,
  deleteAllRecords,
  deleteRecordsByIds,
  updateRecords,
} from "@trong-orm/records";
import { empty, sql } from "@trong-orm/sql";
import { nanoid } from "nanoid";
import { useState } from "react";
import Highlighter from "react-highlight-words";

import { usePaginator } from "./hooks/usePaginator";
import { INoteRecord, notesRecords } from "./records/notesRecords";

const Row = ({
  rec,
  textToSearch,
}: {
  rec: INoteRecord;
  textToSearch: string;
}) => {
  const [deleteRecord, deleteRecordState] = useRunQuery(() => async (db) => {
    await deleteRecordsByIds(db, notesRecords, [rec.id]);
  });

  const [updateRecord, updateRecordState] = useRunQuery(() => async (db) => {
    console.log(
      await updateRecords(db, notesRecords, [
        {
          ...rec,
          title: rec.title + " updated!",
          content: rec.content + " updated!",
        },
      ])
    );
  });

  return (
    <tr key={rec.id}>
      <td>{rec.title}</td>
      <td>
        <Highlighter
          searchWords={[textToSearch]}
          autoEscape={true}
          textToHighlight={rec.content}
        />
      </td>
      <td>{rec.createdAt.toLocaleString()}</td>
      <td>{rec.updatedAt.toLocaleString()}</td>
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
            updateRecordState.type !== "loaded" &&
            updateRecordState.type !== "idle"
          }
        >
          Update
        </button>
      </td>
    </tr>
  );
};

export const List = () => {
  const [textToSearch, setTextToSearch] = useState<string>("");

  const baseSql = useSql(
    sql`SELECT * FROM ${notesRecords} ${
      textToSearch ? sql`WHERE content LIKE ${"%" + textToSearch + "%"}` : empty
    }`
  );

  const {
    pagerSql,
    totalPages,
    currentPage,
    totalCount,
    isNextPageAvailable,
    isPrevPageAvailable,
    nextPage,
    prevPage,
  } = usePaginator({
    perPage: 50,
    baseSql: baseSql,
  });

  const recordsResult = useRecords(notesRecords, sql`${baseSql} ${pagerSql}`);

  const [createNotes, createNotesState] = useRunQuery(
    (count: number) => async (db) => {
      await createRecords(
        db,
        notesRecords,
        Array.from(Array(count).keys()).map((i) => ({
          id: nanoid(),
          title: faker.lorem.words(4),
          content: faker.lorem.paragraph(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      );
    }
  );

  const [deleteAll, deleteAllState] = useRunQuery(() => async (db) => {
    const deletedRecords = await deleteAllRecords(db, notesRecords);

    runAfterTransactionCommitted(db, () => {
      console.log("It runs after transaction committed!", deletedRecords);
    });
  });

  return (
    <>
      {[100, 1000, 10_000, 100_000].map((count) => (
        <button
          key={count}
          onClick={() => createNotes(count)}
          disabled={
            createNotesState.type === "loading" ||
            createNotesState.type === "waitingDb"
          }
        >
          {createNotesState.type === "loading"
            ? "Loading..."
            : `Add  ${count} records!`}
        </button>
      ))}

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
          {recordsResult.type === "loaded" &&
            recordsResult.data.map((r) => (
              <Row rec={r} textToSearch={textToSearch} key={r.id} />
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
