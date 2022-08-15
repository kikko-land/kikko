import { IContainsTable, ISql, ISqlAdapter, sql } from "@kikko-land/sql";

import { IBaseToken, isToken } from "../types";
import { alias } from "./alias";
import { toToken } from "./rawSql";
import { wrapParentheses } from "./utils";

export interface IFromState {
  _fromValues: (
    | IContainsTable
    | IBaseToken
    | { select: IContainsTable | IBaseToken; alias: string }
  )[];

  from: typeof from;
}

export function from<T extends IFromState>(
  this: T,
  ...values: (
    | IBaseToken
    | ISqlAdapter
    | IContainsTable
    | string
    | Record<string, IBaseToken | ISqlAdapter | IContainsTable | string>
  )[]
): T {
  return {
    ...this,
    _fromValues: [
      ...this._fromValues,
      ...values
        .map((v) => {
          if (typeof v === "string") {
            return sql.table(v);
          } else if (isToken(v) || sql.isSql(v) || sql.isTable(v)) {
            return toToken(wrapParentheses(v));
          } else {
            return Object.entries(v).map(([k, v]) => ({
              select:
                typeof v === "string"
                  ? sql.table(v)
                  : toToken(wrapParentheses(v)),
              alias: k,
            }));
          }
        })
        .flat(),
    ],
  };
}

export const fromToSql = (state: IFromState): ISql | null => {
  return state._fromValues.length > 0
    ? sql.join(
        state._fromValues.map((v) =>
          isToken(v) || sql.isTable(v) ? v : alias(v.select, v.alias)
        )
      )
    : null;
};
