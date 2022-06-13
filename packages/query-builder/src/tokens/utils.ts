import {
  IContainsTable,
  ISqlAdapter,
  PrimitiveValue,
  Sql,
  sql,
} from "@trong-orm/sql";

import { IBaseToken, isToken, TokenType } from "../types";
import { isBinaryOperator } from "./binary";

export const wrapParentheses = <
  T extends IBaseToken | ISqlAdapter | PrimitiveValue | IContainsTable
>(
  val: T
): T | Sql =>
  (isBinaryOperator(val) && val.operator === "OR") ||
  (isToken(val) &&
    (val.type === TokenType.Select || val.type === TokenType.Values))
    ? sql`(${val})`
    : val;
