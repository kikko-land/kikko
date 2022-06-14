import { IBaseToken } from "../types";
import { and, conditionValuesToToken, IConditionValue, or } from "./binary";

export interface IWhereState {
  whereValue?: IBaseToken;

  where: typeof where;
  orWhere: typeof orWhere;
}

const constructWhere = function <T extends IWhereState>(
  state: T,
  andOrOr: "and" | "or",
  values: IConditionValue[]
): T {
  const finalValues = state.whereValue
    ? [state.whereValue, ...conditionValuesToToken(values)]
    : conditionValuesToToken(values);

  if (finalValues.length > 1) {
    return {
      ...state,
      whereValue: andOrOr === "and" ? and(...finalValues) : or(...finalValues),
    };
  } else {
    return { ...state, whereValue: finalValues[0] };
  }
};

export function where<T extends IWhereState>(
  this: T,
  ...values: IConditionValue[]
) {
  return constructWhere(this, "and", values);
}

export function orWhere<T extends IWhereState>(
  this: T,
  ...values: IConditionValue[]
) {
  return constructWhere(this, "or", values);
}
