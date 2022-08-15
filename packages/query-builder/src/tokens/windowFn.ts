import { ISqlAdapter, sql } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";
import { and, conditionValuesToToken, IConditionValue } from "./binary";

export interface IWindowClause extends IBaseToken<TokenType.WindowFn> {
  _fn: ISqlAdapter;
  _filterValue?: IBaseToken<TokenType>;
  _overValue?: IBaseToken<TokenType.WindowBody>;

  filter(...values: IConditionValue[]): this;
  over(arg: IBaseToken<TokenType>): this;
}

export const windowFn = (fn: ISqlAdapter | IBaseToken): IWindowClause => {
  return {
    _fn: fn,
    type: TokenType.WindowFn,
    filter(...values) {
      const finalValues = this._filterValue
        ? [this._filterValue, ...conditionValuesToToken(values)]
        : conditionValuesToToken(values);

      if (finalValues.length > 1) {
        return {
          ...this,
          _filterValue: and(...finalValues),
        };
      } else {
        return { ...this, _filterValue: finalValues[0] };
      }
    },
    over() {
      return this;
    },
    toSql() {
      return sql.join(
        [
          this._fn,
          ...(this._filterValue
            ? [sql`FILTER (WHERE `, this._filterValue, sql`)`]
            : []),
          sql`OVER`,
          this._overValue ? sql`(${this._overValue})` : sql`()`,
        ],
        " "
      );
    },
  };
};

export const windowBody = () => {};
