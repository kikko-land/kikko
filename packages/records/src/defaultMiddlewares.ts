import { IDbState, runInTransaction, runQueries, runQuery } from "@trong/core";
import { generateInsert, generateUpdate, join, sql } from "@trong/sql";

import {
  ICreateMiddleware,
  IDeleteMiddleware,
  IGetMiddleware,
  IUpdateMiddleware,
} from "./middlewares";
import { chunk } from "./utils";

// TODO: move records chunking to helper

export const insertRecordsMiddleware =
  <
    Row extends Record<string, any> & { id: string },
    Rec extends Record<string, any> & { id: string }
  >(): ICreateMiddleware<Row, Rec> =>
  async (args) => {
    const { actions, dbState, recordConfig, next } = args;

    for (const action of actions) {
      // sqlite max vars = 32766
      // Let's take table columns count to 20, so 20 * 1000 will fit the restriction
      const chunked = chunk(action.records, 1000);

      const toExec = async (state: IDbState) => {
        for (const records of chunked) {
          // TODO: maybe runQueries? But then a large object will need to be transferred, that may cause freeze

          await runQuery(
            state,
            generateInsert(
              recordConfig.table.name,
              records.map((r) => recordConfig.serialize(r)),
              action.replace
            )
          );
        }
      };

      await (chunked.length > 1
        ? runInTransaction(dbState, toExec)
        : toExec(dbState));
    }

    return await next(args);
  };

export const selectRecordsMiddleware =
  <
    Row extends Record<string, any> & { id: string },
    Rec extends Record<string, any> & { id: string }
  >(): IGetMiddleware<Row, Rec> =>
  async (args) => {
    const { actions, dbState, recordConfig, next } = args;

    const resultRecords: Rec[] = [];

    for (const action of actions) {
      const rows = await runQuery<Row>(dbState, action.query);

      resultRecords.push(
        ...rows.map((row) => recordConfig.deserialize(row) as Rec)
      );
    }

    return await next({ ...args, result: resultRecords });
  };

export const deleteRecordsMiddleware =
  <
    Row extends Record<string, any> & { id: string },
    Rec extends Record<string, any> & { id: string }
  >(): IDeleteMiddleware<Row, Rec> =>
  async (args) => {
    const { actions, dbState, recordConfig, next } = args;

    for (const action of actions) {
      const chunked = chunk(action.ids, 1000);

      const toExec = async (state: IDbState) => {
        for (const ids of chunked) {
          // TODO: maybe runQueries? But then a large object will need to be transferred, that may cause freeze
          await runQuery(
            dbState,
            sql`DELETE FROM ${recordConfig} WHERE id IN (${join(
              ids.map((id) => id)
            )})`
          );
        }
      };

      await (chunked.length > 1
        ? runInTransaction(dbState, toExec)
        : toExec(dbState));
    }

    return await next(args);
  };

export const updateRecordsMiddleware =
  <
    Row extends Record<string, any> & { id: string },
    Rec extends Record<string, any> & { id: string }
  >(): IUpdateMiddleware<Row, Rec> =>
  async (args) => {
    const { actions, dbState, recordConfig, next } = args;

    for (const action of actions) {
      await runQueries(
        dbState,
        action.partialRecords.map(
          (rec) =>
            sql`${generateUpdate(recordConfig.table.name, rec)} WHERE id=${
              rec.id
            }`
        )
      );
    }

    return await next(args);
  };
