import { IContainsTable, ISqlAdapter, sql } from "@trong-orm/sql";

import { IBaseToken } from "../types";
import { wrapParentheses } from "./utils";

// TODO: join
export interface IFromState {
  fromValues: (IContainsTable | IBaseToken)[];

  from: typeof from;
}

export function from<T extends IFromState>(
  this: T,
  ...values: (IBaseToken | ISqlAdapter | IContainsTable)[]
) {
  return {
    ...this,
    fromValues: [
      ...this.fromValues,
      ...values.map((v) =>
        typeof v === "string" ? sql.table(v) : wrapParentheses(v)
      ),
    ],
  };
}
