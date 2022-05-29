import { runQuery } from "../runQueries";
import { generateInsert } from "../sqlHelpers";
import { runInTransaction } from "../transaction";
import { IDbState } from "../types";
import { chunk } from "../utils";
import { buildMiddleware, ICreateRecordAction } from "./middlewares";

export const insertRecordMiddleware = buildMiddleware(<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>() => async (dbState, recordConfig, actions, next) => {
  const createActions = actions.filter(
    (ac) => ac.type === "create"
  ) as ICreateRecordAction<Rec>[];

  for (const action of createActions) {
    // sqlite max vars = 32766
    // Let's take table columns count to 20, so 20 * 1000 will fit the restriction
    const chunked = chunk(action.records, 1000);

    const toExec = async (state: IDbState) => {
      for (const records of chunk(action.records, 1000)) {
        // TODO: maybe runQueries? But then a large object will need to be transferred, that may cause freeze
        await runQuery(
          state,
          generateInsert(
            recordConfig.table,
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

  return await next(dbState, recordConfig, actions);
});
