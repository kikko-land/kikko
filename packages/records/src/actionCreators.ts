import { IDbState } from "@trong-orm/core";
import { empty, join, Sql, sql } from "@trong-orm/sql";

import { IRecordConfig } from "./defineRecord";
import { applyAction } from "./middlewares";

export const getRecords = async <
  Row extends object & { id: string },
  Rec extends object & { id: string }
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
      { records: [] as Rec[] },
      { query: sql }
    )
  ).result;
};

export const createRecords = async <
  Row extends object & { id: string },
  Rec extends object & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  recs: Rec[],
  replace = false
) => {
  if (recs.length === 0) return { createdRecords: [] };

  return (
    await applyAction(
      db,
      recordConfig,
      recordConfig.middlewares.create,
      { createdRecords: [] as Rec[] },
      { records: recs, replace }
    )
  ).result;
};

export const createRecord = async <
  Row extends object & { id: string },
  Rec extends object & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  obj: Rec,
  replace = false
) => {
  const { createdRecords } = await createRecords(
    db,
    recordConfig,
    [obj],
    replace
  );

  return { createRecord: createdRecords[0] };
};

export const deleteRecords = async <
  Row extends object & { id: string },
  Rec extends object & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  whereStatement: Sql
) => {
  return (
    await applyAction(
      db,
      recordConfig,
      recordConfig.middlewares.delete,
      { deletedRecords: [] as Rec[] },
      { whereStatement: whereStatement }
    )
  ).result;
};

export const deleteRecordsByIds = async <
  Row extends object & { id: string },
  Rec extends object & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  ids: string[]
) => {
  return deleteRecords(db, recordConfig, sql`WHERE id IN (${join(ids)})`);
};

export const deleteAllRecords = async <
  Row extends object & { id: string },
  Rec extends object & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>
) => {
  return deleteRecords(db, recordConfig, empty);
};

export const updateRecords = async <
  Row extends object & { id: string },
  Rec extends object & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  recs: (Partial<Rec> & { id: string })[]
) => {
  if (recs.length === 0) return { updatedRecords: [] };

  return (
    await applyAction(
      db,
      recordConfig,
      recordConfig.middlewares.update,
      { updatedRecords: [] as Rec[] },
      { partialRecords: recs }
    )
  ).result;
};

export const updateRecord = async <
  Row extends object & { id: string },
  Rec extends object & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  rec: Partial<Rec> & { id: string }
) => {
  const { updatedRecords } = await updateRecords(db, recordConfig, [rec]);

  return { updatedRecord: updatedRecords[0] };
};
