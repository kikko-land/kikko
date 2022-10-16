import { sql } from "@kikko-land/boono-sql";
import {
  makeId,
  suppressLog,
  useDbStrict,
  useRunQuery,
} from "@kikko-land/react";
import { useCallback, useState } from "react";
import { useSearchParam } from "react-use";

import { backendOptions } from "./AppBenchmark";

export const Benchmark = () => {
  const [logs, setLogs] = useState<string[]>([]);

  const backendName = (useSearchParam("backend") ||
    "waMinimal") as keyof typeof backendOptions;

  const [runBenchmark, benchmarkState] = useRunQuery(
    (db) => () =>
      suppressLog(db, async (db) =>
        db.runInTransaction(async (db) => {
          const time = new Date().getTime();
          setLogs((l) => [...l, "Start inserting..."]);

          for (let i = 0; i < 100; i++) {
            await db.runQuery(
              sql`INSERT INTO kv (key, value) VALUES ${sql.join(
                [...Array<number>(10_000)].map(
                  () =>
                    sql`(${makeId()}, ${(
                      (Math.random() * 100) |
                      0
                    ).toString()})`
                )
              )}`
            );
          }

          db.runAfterTransactionCommitted(() => {
            void (async () => {
              setLogs((l) => [
                ...l,
                `Done inserting in ${(new Date().getTime() - time) / 1000}s`,
              ]);

              const summingTime = new Date().getTime();

              setLogs((l) => [...l, `Summing...`]);
              await db.runQuery(sql`SELECT SUM(value) FROM kv`);
              setLogs((l) => [
                ...l,
                `Done summing in ${
                  (new Date().getTime() - summingTime) / 1000
                }s`,
              ]);
            })();
          });
        })
      )
  );

  const db = useDbStrict();
  const clearAndRun = useCallback(async () => {
    setLogs((l) => [...l, "Clearing data first..."]);
    await db.runQuery(sql`DELETE FROM kv;`);
    setLogs((l) => [...l, "Clearing done!"]);

    setLogs((l) => [...l, "Reading pragma..."]);
    const pragma = JSON.stringify(
      await db.runQueries([
        sql`SELECT * FROM pragma_cache_size`,
        sql`SELECT * FROM pragma_journal_mode`,
        sql`SELECT * FROM pragma_page_size`,
      ]),
      null,
      2
    );
    setLogs((l) => [...l, pragma, "Reading pragma done!"]);

    await runBenchmark();
  }, [db, runBenchmark]);

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

      <button
        onClick={() => void clearAndRun()}
        disabled={benchmarkState.type === "running"}
      >
        {benchmarkState.type === "running" ? "Running..." : "Run benchmark"}
      </button>

      <div>
        <pre>{logs.join("\n")}</pre>
      </div>
    </>
  );
};
