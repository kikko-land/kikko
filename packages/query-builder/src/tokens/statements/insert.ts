import { IContainsTable, PrimitiveValue } from "@trong-orm/sql";

import { IBaseToken, TokenType } from "../../types";
import { ICompoundState } from "../compounds";
import { ICTEState } from "../cte";
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
    IReturningState {
  intoTable: IContainsTable;
  insertOr: "ABORT" | "FAIL" | "IGNORE" | "REPLACE" | "ROLLBACK";
  columns: string[];

  toInsert:
    | IValuesStatement
    | ISelectStatement
    | Record<string, PrimitiveValue | IBaseToken>;

  orAbort(): IInsertStatement;
  orFail(): IInsertStatement;
  orIgnore(): IInsertStatement;
  orReplace(): IInsertStatement;
  orRollback(): IInsertStatement;
}

// insert({}).into('table')
