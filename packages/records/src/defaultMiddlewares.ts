import {
  IDbState,
  runInTransaction,
  runQueries,
  runQuery,
} from "@trong-orm/core";
import { generateInsert, generateUpdate, ISql, sql } from "@trong-orm/sql";

import {
  ICreateMiddleware,
  IDeleteMiddleware,
  IGetMiddleware,
  IUpdateMiddleware,
} from "./middlewares";
import { chunk } from "./utils";

// Sqlite restricts max params in one query to 30_000
// That's why we split objects to chunks and run operations in transaction
const runQueriesInChunks = async <R extends Record<string, unknown>>(
  state: IDbState,
  objs: R[],
  generateQuery: (chunkedObjs: R[]) => ISql
): Promise<R[]> => {
  // sqlite max vars = 32766
  // Let's take table avg columns count to 20, so 20 * 1000 will fit the restriction
  const chunked = chunk(objs, 1000);

  const toExec = async (state: IDbState) => {
    const result: R[] = [];
    // Maybe runQueries instead of iterating? But then a large object will need to be transferred, that may cause freeze
    for (const records of chunked) {
      result.push(...(await runQuery<R>(state, generateQuery(records))));
    }

    return result;
  };

  return await (chunked.length > 1
    ? runInTransaction(state, toExec)
    : toExec(state));
};

export const insertRecordsMiddleware =
  <
    Row extends object & { id: string },
    Rec extends object & { id: string }
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

    return await next({ ...args, result: { createdRecords: action.records } });
  };

export const selectRecordsMiddleware =
  <
    Row extends object & { id: string },
    Rec extends object & { id: string }
  >(): IGetMiddleware<Row, Rec> =>
  async (args) => {
    const { action, dbState, recordConfig, next } = args;

    const recs = (await runQuery<Row>(dbState, action.query)).map(
      (row) => recordConfig.deserialize(row) as Rec
    );

    return await next({ ...args, result: { records: recs } });
  };

export const deleteRecordsMiddleware =
  <
    Row extends object & { id: string },
    Rec extends object & { id: string }
  >(): IDeleteMiddleware<Row, Rec> =>
  async (args) => {
    const { action, dbState, recordConfig, next } = args;

    const records = (
      await runQuery<Row>(
        dbState,
        sql`DELETE FROM ${recordConfig} ${action.whereStatement} returning *`
      )
    ).map((r) => recordConfig.deserialize(r));

    return await next({ ...args, result: { deletedRecords: records } });
  };

export const updateRecordsMiddleware =
  <
    Row extends object & { id: string },
    Rec extends object & { id: string }
  >(): IUpdateMiddleware<Row, Rec> =>
  async (args) => {
    const { action, dbState, recordConfig, next } = args;

    const updatedRecords: Rec[] = [];

    const chunkedRecords = chunk(action.partialRecords, 1000) as Rec[][];

    for (const records of chunkedRecords) {
      (
        await runQueries<Row>(
          dbState,
          records.map((rec) => {
            if (!rec.id)
              throw new Error(
                "To update record you must provide an id attribute of object to update"
              );

            return sql`${generateUpdate(
              recordConfig.table.name,
              recordConfig.serialize(rec)
            )} WHERE id=${rec.id} returning *`;
          })
        )
      ).forEach((rows) => {
        updatedRecords.push(...rows.map((r) => recordConfig.deserialize(r)));
      });
    }

    return await next({ ...args, result: { updatedRecords: updatedRecords } });
  };
