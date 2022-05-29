import { IDbState } from "../types";
import { IRecordConfig } from "./createRecordConfig";
import { applyAction as applyAction } from "./middlewares";

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

  console.log("apply action!");
  await applyAction(db, recordConfig, [
    { type: "create", records: recs, replace },
  ]);
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
