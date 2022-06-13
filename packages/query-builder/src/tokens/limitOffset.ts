import { empty, ISqlAdapter, join, PrimitiveValue, sql } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";
import { toToken } from "./rawSql";
import { wrapParentheses } from "./utils";

export interface ILimitOffsetTerm
  extends IBaseToken<TokenType.LimitOffsetTerm> {
  limitValue?: IBaseToken;
  offsetValue?: IBaseToken;
}

export interface ILimitOffsetState {
  limitOffsetValue: ILimitOffsetTerm;
}

export const buildInitialLimitOffsetState = (): ILimitOffsetTerm => {
  return {
    type: TokenType.LimitOffsetTerm,
    toSql() {
      return this.limitValue
        ? join(
            [
              this.limitValue
                ? sql`LIMIT ${wrapParentheses(this.limitValue)}`
                : null,
              this.offsetValue && this.limitValue
                ? sql`OFFSET ${wrapParentheses(this.offsetValue)}`
                : null,
            ].filter((v) => v),
            " "
          )
        : empty;
    },
  };
};

export function limit<T extends ILimitOffsetState>(
  this: T,
  val: IBaseToken | ISqlAdapter | PrimitiveValue
): T {
  return {
    ...this,
    limitOffsetValue: { ...this.limitOffsetValue, limitValue: toToken(val) },
  };
}

export function withoutLimit<T extends ILimitOffsetState>(this: T): T {
  return {
    ...this,
    limitOffsetValue: { ...this.limitOffsetValue, limitValue: undefined },
  };
}

export function offset<T extends ILimitOffsetState>(
  this: T,
  val: IBaseToken | ISqlAdapter | PrimitiveValue
): T {
  return {
    ...this,
    limitOffsetValue: { ...this.limitOffsetValue, offsetValue: toToken(val) },
  };
}

export function withoutOffset<T extends ILimitOffsetState>(this: T): T {
  return {
    ...this,
    limitOffsetValue: { ...this.limitOffsetValue, offsetValue: undefined },
  };
}
