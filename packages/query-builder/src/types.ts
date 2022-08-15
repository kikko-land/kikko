import { ISql } from "@kikko-land/sql";

export enum TokenType {
  Binary = "Binary",
  Unary = "Unary",
  Alias = "Alias",
  Compound = "Compound",
  Select = "Select",
  Update = "Update",
  Delete = "Delete",
  Insert = "Insert",
  Values = "Values",
  OrderTerm = "OrderTerm",
  LimitOffsetTerm = "LimitOffsetTerm",
  RawSql = "RawSql",
  CompoundOperator = "CompoundOperator",
  CTE = "CTE",
  Join = "Join",
  Returning = "Returning",
}

export interface IBaseToken<T extends TokenType = TokenType> {
  type: T;
  toSql(): ISql;
}

export const isToken = (t: unknown): t is IBaseToken => {
  return (
    t !== null &&
    typeof t === "object" &&
    "type" in t &&
    "toSql" in t &&
    Object.values(TokenType).includes((t as IBaseToken).type)
  );
};

export function assertUnreachable(x: never): never {
  throw new Error(`Didn't expect to get here: ${JSON.stringify(x)}`);
}
