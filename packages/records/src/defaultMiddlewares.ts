import { IDbState, runInTransaction, runQueries, runQuery } from "@trong-orm/core";
import { generateInsert, generateUpdate, join, Sql, sql } from "@trong-orm/sql";

import {
  ICreateMiddleware,
  IDeleteMiddleware,
  IGetMiddleware,
  IUpdateMiddleware,
} from "./middlewares";
import { chunk } from "./utils";

// Sqlite restricts max params in one query to 30_000
// That's why we split objects to chunks and run operations in transaction
const runQueriesInChunks = async <T extends unknown>(
  state: IDbState,
  objs: T[],
  generateQuery: (chunkedObjs: T[]) => Sql
) => {
  // sqlite max vars = 32766
  // Let's take table avg columns count to 20, so 20 * 1000 will fit the restriction
  const chunked = chunk(objs, 1000);

  const toExec = async (state: IDbState) => {
    // Maybe runQueries instead of iterating? But then a large object will need to be transferred, that may cause freeze
    for (const records of chunked) {
      await runQuery(state, generateQuery(records));
    }
  };

  await (chunked.length > 1 ? runInTransaction(state, toExec) : toExec(state));
};

export const insertRecordsMiddleware =
  <
    Row extends Record<string, any> & { id: string },
    Rec extends Record<string, any> & { id: string }
  >(): ICreateMiddleware<Row, Rec> =>
  async (args) => {
    const { action, dbState, recordConfig, next } = args;

    await runQueriesInChunks(dbState, action.records, (records) =>
      generateInsert(
        recordConfig.table.name,
        records.map((r) => recordConfig.serialize(r)),
        action.replace
      )
    );

    return await next(args);
  };

export const selectRecordsMiddleware =
  <
    Row extends Record<string, any> & { id: string },
    Rec extends Record<string, any> & { id: string }
  >(): IGetMiddleware<Row, Rec> =>
  async (args) => {
    const { action, dbState, recordConfig, next } = args;

    const resultRecords: Rec[] = [];

    const rows = await runQuery<Row>(dbState, action.query);

    resultRecords.push(
      ...rows.map((row) => recordConfig.deserialize(row) as Rec)
    );

    return await next({ ...args, result: resultRecords });
  };

export const deleteRecordsMiddleware =
  <
    Row extends Record<string, any> & { id: string },
    Rec extends Record<string, any> & { id: string }
  >(): IDeleteMiddleware<Row, Rec> =>
  async (args) => {
    const { action, dbState, recordConfig, next } = args;

    await runQueriesInChunks(
      dbState,
      action.ids,
      (ids) =>
        sql`DELETE FROM ${recordConfig} WHERE id IN (${join(
          ids.map((id) => id)
        )})`
    );

    return await next(args);
  };

export const updateRecordsMiddleware =
  <
    Row extends Record<string, any> & { id: string },
    Rec extends Record<string, any> & { id: string }
  >(): IUpdateMiddleware<Row, Rec> =>
  async (args) => {
    const { action, dbState, recordConfig, next } = args;

    const chunkedRecords = chunk(action.partialRecords, 1000);

    for (const records of chunkedRecords) {
      await runQueries(
        dbState,
        records.map((rec) => {
          if (!rec.id)
            throw new Error(
              "To update record you must provide an id attribute of object to update"
            );

          return sql`${generateUpdate(recordConfig.table.name, rec)} WHERE id=${
            rec.id
          }`;
        })
      );
    }

    return await next(args);
  };
