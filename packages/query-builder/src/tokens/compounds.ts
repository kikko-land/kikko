import { ISql, sql } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";
import { toToken } from "./rawSql";
import { ISelectStatement, isSelect } from "./statements/select";
import { isValues, IValuesStatement } from "./statements/values";

type IUnionArg = ISelectStatement | IValuesStatement | ISql;

export interface ICompoundOperator extends IBaseToken<TokenType.OrderTerm> {
  compoundType: "UNION" | "UNION ALL" | "INTERSECT" | "EXCEPT";
  value: ISelectStatement | IValuesStatement | IBaseToken<TokenType.RawSql>;
}

export interface ICompoundState {
  compoundValues: ICompoundOperator[];

  union: typeof union;
  unionAll: typeof unionAll;
  intersect: typeof intersect;
  except: typeof except;
  withoutCompound: typeof withoutCompound;
}

const makeCompounds = <T extends ICompoundState>(
  state: T,
  type: "UNION" | "UNION ALL" | "INTERSECT" | "EXCEPT",
  values: IUnionArg[]
): T => {
  return {
    ...state,
    compoundValues: [
      ...state.compoundValues,
      ...values.map((val): ICompoundOperator => {
        const token = toToken(val);

        return {
          type: TokenType.OrderTerm,
          compoundType: type,
          value: isSelect(token)
            ? token.withoutWith().withoutLimit().withoutOrder().withoutOffset()
            : isValues(token)
            ? token.withoutWith().withoutLimit().withoutOrder().withoutOffset()
            : (token as IValuesStatement | IBaseToken<TokenType.RawSql>),
          toSql() {
            return sql`${sql.raw(this.compoundType)} ${this.value}`;
          },
        };
      }),
    ],
  };
};

export function union<T extends ICompoundState>(
  this: T,
  ...values: IUnionArg[]
) {
  return makeCompounds(this, "UNION", values);
}
export function unionAll<T extends ICompoundState>(
  this: T,
  ...values: IUnionArg[]
) {
  return makeCompounds(this, "UNION ALL", values);
}
export function intersect<T extends ICompoundState>(
  this: T,
  ...values: IUnionArg[]
) {
  return makeCompounds(this, "INTERSECT", values);
}
export function except<T extends ICompoundState>(
  this: T,
  ...values: IUnionArg[]
) {
  return makeCompounds(this, "EXCEPT", values);
}

export function withoutCompound<T extends ICompoundState>(this: T) {
  return { ...this, compoundValues: [] };
}
