import { IContainsTable, sql } from "@kikko-land/sql";

import { IBaseToken, TokenType } from "../../types";
import { ICTEState, With, withoutWith, withRecursive } from "../cte";
import {
  IReturningState,
  returning,
  returningForState,
  withoutReturningForState,
} from "../returning";
import { IWhereState, orWhere, where } from "../where";

export interface IDeleteStatement
  extends IBaseToken<TokenType.Delete>,
    ICTEState,
    IWhereState,
    IReturningState {
  _deleteTable: IContainsTable;
}

export const deleteFrom = (tbl: string | IContainsTable): IDeleteStatement => {
  return {
    type: TokenType.Delete,
    _deleteTable: typeof tbl === "string" ? sql.table(tbl) : tbl,
    _returningValue: returning(),

    with: With,
    withoutWith,
    withRecursive,

    where,
    orWhere,

    returning: returningForState,
    withoutReturning: withoutReturningForState,

    toSql() {
      return sql.join(
        [
          this._cteValue ? this._cteValue : null,
          sql`DELETE FROM ${this._deleteTable}`,
          this._whereValue ? sql`WHERE ${this._whereValue}` : null,
          this._returningValue,
        ].filter((v) => v),
        " "
      );
    },
  };
};
