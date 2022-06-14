import { IContainsTable, join, sql, table } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../../types";
import { ICTEState, With, withoutWith, withRecursive } from "../cte";
import { IReturningState } from "../returning";
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
    deleteTable: typeof tbl === "string" ? table(tbl) : tbl,

    with: With,
    withoutWith,
    withRecursive,

    where,
    orWhere,

    toSql() {
      return join(
        [
          this.cteValue ? this.cteValue : null,
          sql`DELETE FROM ${this.deleteTable}`,
          this.whereValue ? sql`WHERE ${this.whereValue}` : null,
          // TODO: add returning code
        ].filter((v) => v),
        " "
      );
    },
  };
};
