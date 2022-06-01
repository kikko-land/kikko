import { IDbState, runInTransaction, runQuery } from "@trong/core";
import { generateInsert, join, sql } from "@trong/sql";

import {
  buildMiddleware,
  ICreateRecordAction,
  IDeleteRecordAction,
  IGetAction,
} from "./middlewares";
import { chunk } from "./utils";

// TODO: move records chunking to helper

export const insertRecordsMiddleware = buildMiddleware(<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>() => async (dbState, recordConfig, actions, result, next) => {
  const createActions = actions.filter(
    (ac) => ac.type === "create"
  ) as ICreateRecordAction<Rec>[];

  for (const action of createActions) {
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

  return await next(dbState, recordConfig, actions, result);
});

export const selectRecordsMiddleware = buildMiddleware(<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>() => async (dbState, recordConfig, actions, _result, next) => {
  const getActions = actions.filter((ac) => ac.type === "get") as IGetAction[];

  const resultRecords: Rec[] = [];

  for (const action of getActions) {
    const rows = await runQuery<Row>(dbState, action.query);

    resultRecords.push(
      ...rows.map((row) => recordConfig.deserialize(row) as Rec)
    );
  }

  return await next(dbState, recordConfig, actions, resultRecords);
});

export const deleteRecordsMiddleware = buildMiddleware(<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _Row extends Record<string, any> & { id: string },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _Rec extends Record<string, any> & { id: string }
>() => async (dbState, recordConfig, actions, result, next) => {
  const deleteActions = actions.filter(
    (ac) => ac.type === "delete"
  ) as IDeleteRecordAction[];

  for (const action of deleteActions) {
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

  return await next(dbState, recordConfig, actions, result);
});
