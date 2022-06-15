import { IContainsTable, sql } from "@trong-orm/sql";

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
  deleteTable: IContainsTable;
}

export const deleteFrom = (tbl: string | IContainsTable): IDeleteStatement => {
  return {
    type: TokenType.Delete,
    deleteTable: typeof tbl === "string" ? sql.table(tbl) : tbl,
    returningValue: returning(),

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
          this.cteValue ? this.cteValue : null,
          sql`DELETE FROM ${this.deleteTable}`,
          this.whereValue ? sql`WHERE ${this.whereValue}` : null,
          this.returningValue,
        ].filter((v) => v),
        " "
      );
    },
  };
};
