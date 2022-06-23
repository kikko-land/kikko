import {
  IContainsTable,
  IPrimitiveValue,
  ISqlAdapter,
  isSql,
  sql,
} from "@trong-orm/sql";

import { IBaseToken, isToken, TokenType } from "../../types";
import { ICTEState, With, withoutWith, withRecursive } from "../cte";
import {
  IOrReplaceState,
  orAbort,
  orFail,
  orIgnore,
  orReplace,
  orRollback,
} from "../orReplace";
import { buildRawSql } from "../rawSql";
import {
  IReturningState,
  returning,
  returningForState,
  withoutReturningForState,
} from "../returning";
import { ISelectStatement, isSelect } from "./select";
import { isValues, IValuesStatement } from "./values";

// TODO: on conflict support
export interface IInsertStatement
  extends IBaseToken<TokenType.Insert>,
    ICTEState,
    IReturningState,
    IOrReplaceState {
  intoTable?: IContainsTable;
  columnNames: string[];

  toInsertValue?:
    | IValuesStatement
    | ISelectStatement
    | { columnName: string; value: IPrimitiveValue | IBaseToken }[][];

  setColumnNames(columnNames: string[]): IInsertStatement;
  withoutColumnNames(): IInsertStatement;

  insert(arg: IInsertArg): IInsertStatement;
  withoutInsert(): IInsertStatement;

  withoutInto(): IInsertStatement;
  into(val: string | IContainsTable): IInsertStatement;
}

type IRecArg =
  | Record<string, IPrimitiveValue | IBaseToken | ISqlAdapter>
  | Record<string, IPrimitiveValue | IBaseToken | ISqlAdapter>[];
type IInsertArg = IValuesStatement | ISelectStatement | IRecArg;

const mapRecordArg = (arg: IRecArg) => {
  return (Array.isArray(arg) ? arg : [arg]).map((it) =>
    Object.entries(it).map(([columnName, value]) => {
      return {
        columnName,
        value: isSql(value) && !isToken(value) ? buildRawSql(value) : value,
      };
    })
  );
};

const applyInsertArg = (
  state: IInsertStatement,
  arg: IInsertArg
): IInsertStatement => {
  if (
    state.toInsertValue &&
    (isSelect(state.toInsertValue) || isValues(state.toInsertValue))
  ) {
    throw new Error(
      "Insert value is already state. If you want to change insert values user resetInsert() before."
    );
  }

  if (isSelect(arg) || isValues(arg)) {
    return { ...state, toInsertValue: arg };
  }

  return {
    ...state,
    toInsertValue: Array.isArray(state.toInsertValue)
      ? [...state.toInsertValue, ...mapRecordArg(arg)]
      : mapRecordArg(arg),
  };
};

export const insert = (insertArg: IInsertArg): IInsertStatement => {
  return {
    type: TokenType.Insert,
    returningValue: returning(),
    columnNames: [],
    toInsertValue:
      isSelect(insertArg) || isValues(insertArg)
        ? insertArg
        : mapRecordArg(insertArg),

    with: With,
    withRecursive,
    withoutWith,

    orAbort,
    orFail,
    orIgnore,
    orReplace,
    orRollback,

    returning: returningForState,
    withoutReturning: withoutReturningForState,

    setColumnNames(names: string[]) {
      return { ...this, columnNames: names };
    },
    withoutColumnNames() {
      return { ...this, columnNames: [] };
    },

    insert(arg: IInsertArg) {
      return applyInsertArg(this, arg);
    },
    withoutInsert() {
      return { ...this, toInsertValue: undefined };
    },

    into(val: string | IContainsTable) {
      return {
        ...this,
        intoTable: typeof val === "string" ? sql.table(val) : val,
      };
    },
    withoutInto() {
      return { ...this, intoTable: undefined };
    },

    toSql() {
      if (!this.toInsertValue) {
        throw new Error("Insert values are not set");
      }

      if (!this.intoTable) {
        throw new Error("Into table is not set");
      }

      const columns =
        this.columnNames.length > 0
          ? this.columnNames
          : Array.isArray(this.toInsertValue)
          ? this.toInsertValue[0].map(({ columnName }) => columnName)
          : [];

      return sql.join(
        [
          this.cteValue ? this.cteValue : null,
          sql`INSERT`,
          this.orReplaceValue ? sql`OR ${sql.raw(this.orReplaceValue)}` : null,
          sql`INTO`,
          this.intoTable,
          columns.length > 0
            ? sql`(${sql.join(columns.map((c) => sql.liter(c)))})`
            : null,
          isValues(this.toInsertValue) || isSelect(this.toInsertValue)
            ? this.toInsertValue
            : sql`VALUES ${sql.join(
                this.toInsertValue.map((toInsertColumns) => {
                  const toInsert: (IPrimitiveValue | IBaseToken)[] = Array(
                    toInsertColumns.length
                  );

                  for (const { columnName, value } of toInsertColumns) {
                    const index = columns.indexOf(columnName);

                    if (index === -1) {
                      throw new Error(
                        `Column ${columnName} is not present at columns set: ${columns}. Make sure that you set all columns with setColumnNames() or each insert objects have the same keys present. Tried to insert: ${JSON.stringify(
                          toInsertColumns
                        )}`
                      );
                    }

                    toInsert[index] = value;
                  }

                  return sql`(${sql.join(toInsert)})`;
                })
              )}`,
          this.returningValue,
        ].filter((v) => v),
        " "
      );
    },
  };
};
