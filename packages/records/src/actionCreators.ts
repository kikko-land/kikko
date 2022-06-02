import { IDbState } from "@trong-orm/core";
import { Sql } from "@trong-orm/sql";

import { IRecordConfig } from "./defineRecord";
import { applyAction } from "./middlewares";

export const getRecords = async <
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  sql: Sql
) => {
  return (
    await applyAction(
      db,
      recordConfig,
      recordConfig.middlewares.get,
      { result: [] as Rec[] },
      { query: sql }
    )
  ).result;
};

export const createRecords = async <
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  recs: Rec[],
  replace: boolean = false
) => {
  if (recs.length === 0) return;

  await applyAction(
    db,
    recordConfig,
    recordConfig.middlewares.create,
    {},
    { records: recs, replace }
  );
};

export const createRecord = <
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  obj: Rec,
  replace: boolean = false
) => {
  return createRecords(db, recordConfig, [obj], replace);
};

export const deleteRecords = async <
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  ids: string[]
) => {
  if (ids.length === 0) return;

  await applyAction(
    db,
    recordConfig,
    recordConfig.middlewares.delete,
    {},
    { ids }
  );
};

export const updateRecords = async <
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  recs: (Partial<Rec> & { id: string })[]
) => {
  if (recs.length === 0) return;

  await applyAction(
    db,
    recordConfig,
    recordConfig.middlewares.update,
    {},
    { partialRecords: recs }
  );
};

export const updateRecord = async <
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  rec: Partial<Rec> & { id: string }
) => {
  return updateRecords(db, recordConfig, [rec]);
};
