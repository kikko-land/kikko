import { IContainsTable, ISqlAdapter, table } from "@trong-orm/sql";

import { IBaseToken } from "../types";
import { toToken } from "./rawSql";
import { wrapParentheses } from "./utils";

// TODO: join
export interface IFromState {
  fromValues: IBaseToken[];

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
        toToken(wrapParentheses(typeof v === "string" ? table(v) : v))
      ),
    ],
  };
}
