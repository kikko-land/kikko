import { runQuery } from "../runQueries";
import { generateInsert } from "../sqlHelpers";
import { runInTransaction } from "../transaction";
import { IDbState } from "../types";
import { chunk } from "../utils";

export const createRecords = async <R extends Record<string, any>>(
  state: IDbState,
  table: string,
  objs: R[],
  replace: boolean = false
) => {
  if (objs.length === 0) return;

  // sqlite max vars = 32766
  // Let's take table columns count to 20, so 20 * 1000 will fit the restriction
  const chunked = chunk(objs, 1000);

  const toExec = async (state: IDbState) => {
    for (const chunkObjs of chunk(objs, 1000)) {
      // TODO: maybe runQueries? But then a large object will need to be transferred, that may cause freeze
      await runQuery(state, generateInsert(table, chunkObjs, replace));
    }
  };

  await (chunked.length > 1 ? runInTransaction(state, toExec) : toExec(state));
};

export const createRecord = <R extends Record<string, any>>(
  state: IDbState,
  table: string,
  obj: R,
  replace: boolean = false
) => {
  return createRecords(state, table, [obj], replace);
};
