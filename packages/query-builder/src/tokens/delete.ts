import { IContainsTable } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../types";
import { ICTEState } from "./cte";
import { IWhereState } from "./where";

export interface IDeleteStatement
  extends IBaseToken<TokenType.Delete>,
    ICTEState,
    IWhereState {
  deleteTable: IContainsTable;
}
