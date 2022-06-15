import { IContainsTable, PrimitiveValue } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../../types";
import { ICompoundState } from "../compounds";
import { ICTEState } from "../cte";
import { IOrReplaceState } from "../orReplace";
import { IReturningState } from "../returning";
import { IWhereState } from "../where";
import { ISelectStatement } from "./select";
import { IValuesStatement } from "./values";

// TODO: on conflict support
export interface IInsertStatement
  extends IBaseToken<TokenType.Insert>,
    ICompoundState,
    ICTEState,
    IWhereState,
    IReturningState,
    IOrReplaceState {
  intoTable: IContainsTable;
  columns: string[];

  toInsert:
    | IValuesStatement
    | ISelectStatement
    | Record<string, PrimitiveValue | IBaseToken>;
}

// insert({}).into('table')
