import { IBaseToken, TokenType } from "../types";
import {
  and,
  conditionValuesToToken,
  IBinaryOperator,
  IConditionValue,
  or,
} from "./binary";
import { IUnaryOperator } from "./unary";

export interface IWhereState {
  _whereValue?: IBaseToken<TokenType.RawSql> | IBinaryOperator | IUnaryOperator;

  where: typeof where;
  orWhere: typeof orWhere;
}

const constructWhere = function <T extends IWhereState>(
  state: T,
  andOrOr: "and" | "or",
  values: IConditionValue[]
): T {
  const finalValues = state._whereValue
    ? [state._whereValue, ...conditionValuesToToken(values)]
    : conditionValuesToToken(values);

  if (finalValues.length > 1) {
    return {
      ...state,
      _whereValue: andOrOr === "and" ? and(...finalValues) : or(...finalValues),
    };
  } else {
    return { ...state, _whereValue: finalValues[0] };
  }
};

export function where<T extends IWhereState>(
  this: T,
  ...values: IConditionValue[]
): T {
  return constructWhere(this, "and", values);
}

export function orWhere<T extends IWhereState>(
  this: T,
  ...values: IConditionValue[]
): T {
  return constructWhere(this, "or", values);
}
