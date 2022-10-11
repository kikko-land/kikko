import {
  deleteFrom,
  insert,
  like$,
  select,
  update,
} from "@kikko-land/query-builder";
import {
  makeId,
  sql,
  useCacheQuery,
  useQuery,
  useRunQuery,
} from "@kikko-land/react";
import { chunk } from "lodash-es";
import { LoremIpsum } from "lorem-ipsum";
import { useState } from "react";
import Highlighter from "react-highlight-words";
import { useSearchParam } from "react-use";

import { usePaginator } from "../hooks/usePaginator";
import { backendOptions } from "./AppList";

const lorem = new LoremIpsum({
  sentencesPerParagraph: {
    max: 8,
    min: 4,
  },
  wordsPerSentence: {
    max: 16,
    min: 4,
  },
});

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
  const [deleteRecord, deleteRecordState] = useRunQuery((db) => async () => {
    await db.runQuery(deleteFrom(notesTable).where({ id: row.id }));
  });

  const [updateRecord, updateRecordState] = useRunQuery((db) => async () => {
    await db.runQuery(
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
          onClick={() => void deleteRecord()}
          disabled={deleteRecordState.type !== "idle"}
        >
          Delete
        </button>
        <button
          onClick={() => void updateRecord()}
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
  const backendName = (useSearchParam("backend") ||
    "waMinimal") as keyof typeof backendOptions;

  const [textToSearch, setTextToSearch] = useState<string>("");

  useRunQuery((db) => async () => {
    await db.runQueries([
      sql`
    CREATE TABLE IF NOT EXISTS test(field1);
        `,
      sql`
    INSERT INTO test
      WITH RECURSIVE
        cte(x) AS (
           SELECT random()
           UNION ALL
           SELECT random()
             FROM cte
            LIMIT 10000000
      )
    SELECT x FROM cte;
        `,
    ]);
  });

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
    (db) => async (count: number, useAtomic: boolean) => {
      const queries = chunk(Array.from(Array(count).keys()), 3000).map((ch) =>
        insert(
          ch.map((i) => ({
            id: makeId(),
            title: lorem.generateWords(4),
            content: lorem.generateParagraphs(1),
            createdAt: new Date().getTime(),
            updatedAt: new Date().getTime(),
          }))
        ).into(notesTable)
      );
      if (useAtomic) {
        await db.runAtomicTransaction((scope) => {
          for (const q of queries) {
            scope.addQuery(q);
          }
        });
      } else {
        await db.runInTransaction(async (db) => {
          for (const q of queries) {
            await db.runQuery(q);
          }

          db.runAfterTransactionCommitted(() => {
            console.log('Transaction commited!')
          })
        });
      }
    }
  );

  const [deleteAll, deleteAllState] = useRunQuery((db) => async () => {
    await db.runQuery(deleteFrom(notesTable));
  });

  return (
    <>
      <select
        value={backendName}
        onChange={(e) => {
          // eslint-disable-next-line no-restricted-globals
          history.pushState(
            {},
            "",
            // eslint-disable-next-line no-restricted-globals
            location.pathname + "?backend=" + e.target.value
          );
        }}
      >
        {Object.entries(backendOptions).map(([name, val]) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <br />
      <br />

      {[100, 1000, 10_000, 30_000].map((count) => (
        <div style={{ padding: "5px 0" }} key={count}>
          <button
            onClick={() => void createNotes(count, false)}
            disabled={
              createNotesState.type === "running" ||
              createNotesState.type === "waitingDb"
            }
          >
            {createNotesState.type === "running"
              ? "Loading..."
              : `Add ${count} records(atomic=false)!`}
          </button>

          <button
            onClick={() => void createNotes(count, true)}
            disabled={
              createNotesState.type === "running" ||
              createNotesState.type === "waitingDb"
            }
            style={{ marginLeft: 10 }}
          >
            {createNotesState.type === "running"
              ? "Loading..."
              : `Add ${count} records(atomic=true)!`}
          </button>
        </div>
      ))}

      <button
        onClick={() => void deleteAll()}
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
