import {
  ISqlAdapter,
  isSql,
  join,
  liter,
  PrimitiveValue,
  raw,
  sql,
} from "@trong-orm/sql";

import { IBaseToken, isToken, TokenType } from "../types";
import { toToken } from "./rawSql";
import { wrapParentheses } from "./utils";

// TODO: in null support
// TODO: add ESCAPE for LIKE/NOT LIKE
export interface IBinaryOperator extends IBaseToken<TokenType.Binary> {
  operator:
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
  left: IBaseToken;
  right: IBaseToken | IBaseToken[];
}

export const isBinaryOperator = (t: unknown): t is IBinaryOperator => {
  return (
    t !== null &&
    typeof t === "object" &&
    "type" in t &&
    "format" in t &&
    (t as IBinaryOperator).type === TokenType.Binary
  );
};

const binaryOperator = (
  operator: IBinaryOperator["operator"],
  left: IBaseToken | ISqlAdapter | PrimitiveValue,
  right:
    | IBaseToken
    | ISqlAdapter
    | PrimitiveValue
    | (IBaseToken | ISqlAdapter | PrimitiveValue)[]
): IBinaryOperator => {
  return {
    type: TokenType.Binary,
    left: toToken(left),
    right: Array.isArray(right) ? right.map(toToken) : toToken(right),
    operator,
    toSql() {
      return sql`${wrapParentheses(this.left)} ${raw(this.operator)} ${
        Array.isArray(this.right)
          ? sql`(${join(this.right)})`
          : wrapParentheses(this.right)
      }`;
    },
  };
};

export const notEq$ = (right: IBaseToken | ISqlAdapter | PrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | PrimitiveValue) =>
    notEq(left, right);
};
export const notEq = (
  left: IBaseToken | ISqlAdapter | PrimitiveValue,
  right: IBaseToken | ISqlAdapter | PrimitiveValue
) => {
  return binaryOperator("<>", left, right);
};

export const eq$ = (right: IBaseToken | ISqlAdapter | PrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | PrimitiveValue) => eq(left, right);
};
export const eq = (
  left: IBaseToken | ISqlAdapter | PrimitiveValue,
  right: IBaseToken | ISqlAdapter | PrimitiveValue
) => {
  return binaryOperator("=", left, right);
};

export const gt$ = (right: IBaseToken | ISqlAdapter | PrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | PrimitiveValue) => gt(left, right);
};
export const gt = (
  left: IBaseToken | ISqlAdapter | PrimitiveValue,
  right: IBaseToken | ISqlAdapter | PrimitiveValue
) => {
  return binaryOperator(">", left, right);
};

export const gtEq$ = (right: IBaseToken | ISqlAdapter | PrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | PrimitiveValue) => gtEq(left, right);
};
export const gtEq = (
  left: IBaseToken | ISqlAdapter | PrimitiveValue,
  right: IBaseToken | ISqlAdapter | PrimitiveValue
) => {
  return binaryOperator(">=", left, right);
};

export const lt$ = (right: IBaseToken | ISqlAdapter | PrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | PrimitiveValue) => lt(left, right);
};
export const lt = (
  left: IBaseToken | ISqlAdapter | PrimitiveValue,
  right: IBaseToken | ISqlAdapter | PrimitiveValue
) => {
  return binaryOperator("<", left, right);
};

export const ltEq$ = (right: IBaseToken | ISqlAdapter | PrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | PrimitiveValue) => ltEq(left, right);
};
export const ltEq = (
  left: IBaseToken | ISqlAdapter | PrimitiveValue,
  right: IBaseToken | ISqlAdapter | PrimitiveValue
) => {
  return binaryOperator("<=", left, right);
};

export const like = (
  left: IBaseToken | ISqlAdapter | PrimitiveValue,
  right: IBaseToken | ISqlAdapter | PrimitiveValue
) => {
  return binaryOperator("LIKE", left, right);
};
export const like$ = (right: IBaseToken | ISqlAdapter | PrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | PrimitiveValue) => like(left, right);
};

export const notLike = (
  left: IBaseToken | ISqlAdapter | PrimitiveValue,
  right: IBaseToken | ISqlAdapter | PrimitiveValue
) => {
  return binaryOperator("NOT LIKE", left, right);
};
export const notLike$ = (right: IBaseToken | ISqlAdapter | PrimitiveValue) => {
  return (left: IBaseToken | ISqlAdapter | PrimitiveValue) =>
    notLike(left, right);
};

export const In = (
  left: IBaseToken | ISqlAdapter | PrimitiveValue,
  ...right: (IBaseToken | ISqlAdapter | PrimitiveValue)[]
) => {
  return binaryOperator("IN", left, right);
};
export const notIn = (
  left: IBaseToken | ISqlAdapter | PrimitiveValue,
  ...right: (IBaseToken | ISqlAdapter | PrimitiveValue)[]
) => {
  return binaryOperator("NOT IN", left, right);
};

export const in$ =
  (...values: (IBaseToken | ISqlAdapter | PrimitiveValue)[]) =>
  (left: IBaseToken | ISqlAdapter | PrimitiveValue) => {
    return In(left, ...values);
  };
export const notIn$ =
  (...values: (IBaseToken | ISqlAdapter | PrimitiveValue)[]) =>
  (left: IBaseToken | ISqlAdapter | PrimitiveValue) => {
    return notIn(left, ...values);
  };

export type IConditionValue =
  | IBaseToken
  | ISqlAdapter
  | Record<
      string,
      | ((left: IBaseToken | ISqlAdapter | PrimitiveValue) => IBinaryOperator)
      | IBaseToken
      | ISqlAdapter
      | PrimitiveValue
    >;

export const conditionValuesToToken = (values: IConditionValue[]) => {
  return values
    .flatMap((v) =>
      isToken(v) || isSql(v)
        ? toToken(v)
        : Object.entries(v).map(([k, expr]) =>
            toToken(
              typeof expr === "function" ? expr(liter(k)) : eq(raw(k), expr)
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
