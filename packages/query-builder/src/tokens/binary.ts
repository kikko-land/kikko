import { IPrimitiveValue, ISqlAdapter, sql } from "@kikko-land/sql";

import { IBaseToken, isToken, TokenType } from "../types";
import { toToken } from "./rawSql";
import { wrapParentheses } from "./utils";

// TODO: in null support
// TODO: add ESCAPE for LIKE/NOT LIKE
export interface IBinaryOperator extends IBaseToken<TokenType.Binary> {
  _operator:
    | "<"
    | "<="
    | ">"
    | ">="
    | "="
    | "<>"
    | "AND"
    | "OR"
    | "IN"
    | "NOT IN"
    | "LIKE"
    | "NOT LIKE"
    // TODO: add all
    | "BETWEEN"
    | "NOT BETWEEN"
    | "GLOB"
    | "NOT GLOB"
    | "MATCH"
    | "NOT MATCH"
    | "REGEXP"
    | "NOT REGEXP";
  _left: IBaseToken;
  _right: IBaseToken | IBaseToken[];
}

export const isBinaryOperator = (t: unknown): t is IBinaryOperator => {
  return (
    t !== null &&
    typeof t === "object" &&
    "type" in t &&
    (t as IBinaryOperator).type === TokenType.Binary
  );
};

const binaryOperator = (
  operator: IBinaryOperator["_operator"],
  left: IBaseToken | ISqlAdapter | IPrimitiveValue,
  right:
    | IBaseToken
    | ISqlAdapter
    | IPrimitiveValue
    | (IBaseToken | ISqlAdapter | IPrimitiveValue)[]
): IBinaryOperator => {
  return {
    type: TokenType.Binary,
    _left: toToken(left),
    _right: Array.isArray(right) ? right.map(toToken) : toToken(right),
    _operator: operator,
    toSql() {
      return sql`${wrapParentheses(this._left)} ${sql.raw(this._operator)} ${
        Array.isArray(this._right)
          ? sql`(${sql.join(this._right)})`
          : wrapParentheses(this._right)
      }`;
    },
  };
};

export const notEq$ = (right: IBaseToken | ISqlAdapter | IPrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | IPrimitiveValue) =>
    notEq(left, right);
};
export const notEq = (
  left: IBaseToken | ISqlAdapter | IPrimitiveValue,
  right: IBaseToken | ISqlAdapter | IPrimitiveValue
) => {
  return binaryOperator("<>", left, right);
};

export const eq$ = (right: IBaseToken | ISqlAdapter | IPrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | IPrimitiveValue) => eq(left, right);
};
export const eq = (
  left: IBaseToken | ISqlAdapter | IPrimitiveValue,
  right: IBaseToken | ISqlAdapter | IPrimitiveValue
) => {
  return binaryOperator("=", left, right);
};

export const gt$ = (right: IBaseToken | ISqlAdapter | IPrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | IPrimitiveValue) => gt(left, right);
};
export const gt = (
  left: IBaseToken | ISqlAdapter | IPrimitiveValue,
  right: IBaseToken | ISqlAdapter | IPrimitiveValue
) => {
  return binaryOperator(">", left, right);
};

export const gtEq$ = (right: IBaseToken | ISqlAdapter | IPrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | IPrimitiveValue) =>
    gtEq(left, right);
};
export const gtEq = (
  left: IBaseToken | ISqlAdapter | IPrimitiveValue,
  right: IBaseToken | ISqlAdapter | IPrimitiveValue
) => {
  return binaryOperator(">=", left, right);
};

export const lt$ = (right: IBaseToken | ISqlAdapter | IPrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | IPrimitiveValue) => lt(left, right);
};
export const lt = (
  left: IBaseToken | ISqlAdapter | IPrimitiveValue,
  right: IBaseToken | ISqlAdapter | IPrimitiveValue
) => {
  return binaryOperator("<", left, right);
};

export const ltEq$ = (right: IBaseToken | ISqlAdapter | IPrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | IPrimitiveValue) =>
    ltEq(left, right);
};
export const ltEq = (
  left: IBaseToken | ISqlAdapter | IPrimitiveValue,
  right: IBaseToken | ISqlAdapter | IPrimitiveValue
) => {
  return binaryOperator("<=", left, right);
};

export const like = (
  left: IBaseToken | ISqlAdapter | IPrimitiveValue,
  right: IBaseToken | ISqlAdapter | IPrimitiveValue
) => {
  return binaryOperator("LIKE", left, right);
};
export const like$ = (right: IBaseToken | ISqlAdapter | IPrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | IPrimitiveValue) =>
    like(left, right);
};

export const notLike = (
  left: IBaseToken | ISqlAdapter | IPrimitiveValue,
  right: IBaseToken | ISqlAdapter | IPrimitiveValue
) => {
  return binaryOperator("NOT LIKE", left, right);
};
export const notLike$ = (right: IBaseToken | ISqlAdapter | IPrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | IPrimitiveValue) =>
    notLike(left, right);
};

export const In = (
  left: IBaseToken | ISqlAdapter | IPrimitiveValue,
  ...right: (IBaseToken | ISqlAdapter | IPrimitiveValue)[]
) => {
  return binaryOperator("IN", left, right);
};
export const notIn = (
  left: IBaseToken | ISqlAdapter | IPrimitiveValue,
  ...right: (IBaseToken | ISqlAdapter | IPrimitiveValue)[]
) => {
  return binaryOperator("NOT IN", left, right);
};

export const in$ =
  (...values: (IBaseToken | ISqlAdapter | IPrimitiveValue)[]) =>
  (left: IBaseToken | ISqlAdapter | IPrimitiveValue) => {
    return In(left, ...values);
  };
export const notIn$ =
  (...values: (IBaseToken | ISqlAdapter | IPrimitiveValue)[]) =>
  (left: IBaseToken | ISqlAdapter | IPrimitiveValue) => {
    return notIn(left, ...values);
  };

export type IConditionValue =
  | IBaseToken
  | ISqlAdapter
  | Record<
      string,
      | ((left: IBaseToken | ISqlAdapter | IPrimitiveValue) => IBinaryOperator)
      | IBaseToken
      | ISqlAdapter
      | IPrimitiveValue
    >;

export const conditionValuesToToken = (values: IConditionValue[]) => {
  return values
    .flatMap((v) =>
      isToken(v) || sql.isSql(v)
        ? toToken(v)
        : Object.entries(v).map(([k, expr]) =>
            toToken(
              typeof expr === "function"
                ? expr(sql.liter(k))
                : eq(sql.liter(k), expr)
            )
          )
    )
    .filter((v) => !v.toSql().isEmpty);
};

const conditionOperator = (
  type: "AND" | "OR",
  ...values: IConditionValue[]
): IBinaryOperator => {
  const exprs = conditionValuesToToken(values);

  if (exprs.length <= 1) {
    throw new Error("Must at least two arguments present");
  }

  let current = binaryOperator(type, exprs[0], exprs[1]);

  for (const next of exprs.slice(2)) {
    current = binaryOperator(type, current, next);
  }

  return current;
};

export const and = (...values: IConditionValue[]): IBinaryOperator => {
  return conditionOperator("AND", ...values);
};

export const or = (...values: IConditionValue[]): IBinaryOperator => {
  return conditionOperator("OR", ...values);
};
