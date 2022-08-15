import { ISqlAdapter, sql } from "@kikko-land/sql";

import { IBaseToken, TokenType } from "../types";
import { toToken } from "./rawSql";

export interface IOrderTerm extends IBaseToken<TokenType.OrderTerm> {
  _orderType: "DESC" | "ASC";
  _val: IBaseToken | string;
  _nullOrder?: "NULLS FIRST" | "NULLS LAST";
}

const orderTerm = (
  type: IOrderTerm["_orderType"],
  val: IBaseToken | ISqlAdapter | string,
  nullOrder: IOrderTerm["_nullOrder"]
): IOrderTerm => {
  return {
    type: TokenType.OrderTerm,
    _orderType: type,
    _val: typeof val === "string" ? val : toToken(val),
    _nullOrder: nullOrder,
    toSql() {
      return sql.join(
        [
          typeof this._val === "string" ? sql.liter(this._val) : this._val,
          sql.raw(this._orderType),
          nullOrder ? sql.raw(nullOrder) : sql.empty,
        ],
        " "
      );
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
  nullOrder?: "NULLS FIRST" | "NULLS LAST"
) => {
  return orderTerm("ASC", val, nullOrder);
};

export interface IOrderState {
  _orderByValues: IOrderTerm[];

  orderBy: typeof orderBy;
  withoutOrder: typeof withoutOrder;
}

export function orderBy<T extends IOrderState>(
  this: T,
  ...orderTerm: IOrderTerm[]
): T {
  return {
    ...this,
    _orderByValues: [...this._orderByValues, ...orderTerm],
  };
}

export function withoutOrder<T extends IOrderState>(this: T): T {
  return {
    ...this,
    _orderByValue: undefined,
  };
}
