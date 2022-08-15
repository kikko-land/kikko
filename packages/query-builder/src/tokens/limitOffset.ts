import { IPrimitiveValue, ISqlAdapter, sql } from "@kikko-land/sql";

import { IBaseToken, TokenType } from "../types";
import { toToken } from "./rawSql";
import { wrapParentheses } from "./utils";

export interface ILimitOffsetTerm
  extends IBaseToken<TokenType.LimitOffsetTerm> {
  _limitValue?: IBaseToken;
  _offsetValue?: IBaseToken;
}

export interface ILimitOffsetState {
  _limitOffsetValue: ILimitOffsetTerm;

  limit: typeof limit;
  offset: typeof offset;
  withoutLimit: typeof withoutLimit;
  withoutOffset: typeof withoutOffset;
}

export const buildInitialLimitOffsetState = (): ILimitOffsetTerm => {
  return {
    type: TokenType.LimitOffsetTerm,
    toSql() {
      return this._limitValue
        ? sql.join(
            [
              this._limitValue
                ? sql`LIMIT ${wrapParentheses(this._limitValue)}`
                : null,
              this._offsetValue && this._limitValue
                ? sql`OFFSET ${wrapParentheses(this._offsetValue)}`
                : null,
            ].filter((v) => v),
            " "
          )
        : sql.empty;
    },
  };
};

export function limit<T extends ILimitOffsetState>(
  this: T,
  val: IBaseToken | ISqlAdapter | IPrimitiveValue
): T {
  return {
    ...this,
    _limitOffsetValue: { ...this._limitOffsetValue, _limitValue: toToken(val) },
  };
}

export function withoutLimit<T extends ILimitOffsetState>(this: T): T {
  return {
    ...this,
    _limitOffsetValue: { ...this._limitOffsetValue, _limitValue: undefined },
  };
}

export function offset<T extends ILimitOffsetState>(
  this: T,
  val: IBaseToken | ISqlAdapter | IPrimitiveValue
): T {
  return {
    ...this,
    _limitOffsetValue: {
      ...this._limitOffsetValue,
      _offsetValue: toToken(val),
    },
  };
}

export function withoutOffset<T extends ILimitOffsetState>(this: T): T {
  return {
    ...this,
    _limitOffsetValue: { ...this._limitOffsetValue, _offsetValue: undefined },
  };
}
