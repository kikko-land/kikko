import { ISqlAdapter, sql } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";
import { toToken } from "./rawSql";

export interface IOrderTerm extends IBaseToken<TokenType.OrderTerm> {
  orderType: "DESC" | "ASC";
  val: IBaseToken | string;
  nullOrder?: "NULLS FIRST" | "NULLS LAST";
}

const orderTerm = (
  type: IOrderTerm["orderType"],
  val: IBaseToken | ISqlAdapter | string,
  nullOrder: IOrderTerm["nullOrder"]
): IOrderTerm => {
  return {
    type: TokenType.OrderTerm,
    orderType: type,
    val: typeof val === "string" ? val : toToken(val),
    nullOrder,
    toSql() {
      return sql`ORDER BY ${
        typeof this.val === "string" ? sql.liter(this.val) : this.val
      } ${sql.raw(this.orderType)}${
        nullOrder ? sql.raw(nullOrder) : sql.empty
      }`;
    },
  };
};

export const desc = (
  val: IBaseToken | ISqlAdapter | string,
  nullOrder?: "NULLS FIRST" | "NULLS LAST"
) => {
  return orderTerm("DESC", val, nullOrder);
};

export const asc = (
  val: IBaseToken | ISqlAdapter | string,
  nullOrder: "NULLS FIRST" | "NULLS LAST" = "NULLS FIRST"
) => {
  return orderTerm("ASC", val, nullOrder);
};

export interface IOrderState {
  orderByValues: IOrderTerm[];

  orderBy: typeof orderBy;
  withoutOrder: typeof withoutOrder;
}

export function orderBy<T extends IOrderState>(
  this: T,
  ...orderTerm: IOrderTerm[]
): T {
  return {
    ...this,
    orderByValues: [...this.orderByValues, ...orderTerm],
  };
}

export function withoutOrder<T extends IOrderState>(this: T): T {
  return {
    ...this,
    orderByValue: undefined,
  };
}
