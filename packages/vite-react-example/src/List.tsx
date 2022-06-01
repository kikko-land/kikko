import { faker } from "@faker-js/faker";
import { runAfterTransactionCommitted, runQuery } from "@trong/core";
import {
  useQueryFirstRow,
  useRecords,
  useRunQuery,
  useSql,
} from "@trong/react-hooks";
import { createRecords, defineRecord, deleteRecords } from "@trong/records";
import { empty, Sql, sql, table } from "@trong/sql";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useState } from "react";
import Highlighter from "react-highlight-words";

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

const notesRecords = defineRecord<IRow, IRecord>(table("notes"), {
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
});

const usePaginator = ({
  perPage,
  baseSql,
}: {
  perPage: number;
  baseSql: Sql;
}) => {
  const [currentPage, setPage] = useState(1);

  const countResult = useQueryFirstRow<{ count: number }>(
    sql`SELECT count(*) as count FROM (${baseSql})`
  );

  const totalCount = countResult.data?.count;

  const totalPages =
    totalCount !== undefined ? Math.ceil(totalCount / perPage) : undefined;

  useEffect(() => {
    if (totalPages === undefined) return;
    if (totalPages === 0) {
      setPage(1);

      return;
    }

    if (currentPage > totalPages) {
      setPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const isNextPageAvailable =
    totalPages !== undefined ? currentPage < totalPages : false;
  const isPrevPageAvailable = currentPage > 1;

  const nextPage = useCallback(() => {
    if (isNextPageAvailable) {
      setPage(currentPage + 1);
    }
  }, [currentPage, isNextPageAvailable]);

  const prevPage = useCallback(() => {
    if (isPrevPageAvailable) {
      setPage(currentPage - 1);
    }
  }, [currentPage, isPrevPageAvailable]);

  return {
    pagerSql: sql`LIMIT ${perPage} OFFSET ${perPage * (currentPage - 1)}`,
    totalPages,
    currentPage,
    totalCount,
    isNextPageAvailable,
    isPrevPageAvailable,
    nextPage,
    prevPage,
  };
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
    const result = await runQuery<{ id: string }>(
      db,
      sql`SELECT id FROM ${notesRecords}`
    );
    const toDeleteIds = result.map(({ id }) => id as string);

    await deleteRecords(db, notesRecords, toDeleteIds);

    runAfterTransactionCommitted(db, () => {
      console.log("heY!!!");
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
          </tr>
        </thead>
        <tbody>
          {recordsResult.type === "loaded" &&
            recordsResult.data.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>
                  <Highlighter
                    searchWords={[textToSearch]}
                    autoEscape={true}
                    textToHighlight={r.content}
                  />
                </td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{new Date(r.updatedAt).toLocaleString()}</td>
              </tr>
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
