import {
  IContainsTable,
  IPrimitiveValue,
  ISqlAdapter,
  sql,
} from "@kikko-land/sql";

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
  _intoTable?: IContainsTable;
  _columnNames: string[];

  _toInsertValue?:
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
        value: sql.isSql(value) && !isToken(value) ? buildRawSql(value) : value,
      };
    })
  );
};

const applyInsertArg = (
  state: IInsertStatement,
  arg: IInsertArg
): IInsertStatement => {
  if (
    state._toInsertValue &&
    (isSelect(state._toInsertValue) || isValues(state._toInsertValue))
  ) {
    throw new Error(
      "Insert value is already state. If you want to change insert values user resetInsert() before."
    );
  }

  if (isSelect(arg) || isValues(arg)) {
    return { ...state, _toInsertValue: arg };
  }

  return {
    ...state,
    _toInsertValue: Array.isArray(state._toInsertValue)
      ? [...state._toInsertValue, ...mapRecordArg(arg)]
      : mapRecordArg(arg),
  };
};

export const insert = (insertArg: IInsertArg): IInsertStatement => {
  return {
    type: TokenType.Insert,
    _returningValue: returning(),
    _columnNames: [],
    _toInsertValue:
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

    setColumnNames(names: string[]): IInsertStatement {
      return { ...this, _columnNames: names };
    },
    withoutColumnNames(): IInsertStatement {
      return { ...this, _columnNames: [] };
    },

    insert(arg: IInsertArg): IInsertStatement {
      return applyInsertArg(this, arg);
    },
    withoutInsert(): IInsertStatement {
      return { ...this, _toInsertValue: undefined };
    },

    into(val: string | IContainsTable): IInsertStatement {
      return {
        ...this,
        _intoTable: typeof val === "string" ? sql.table(val) : val,
      };
    },
    withoutInto(): IInsertStatement {
      return { ...this, _intoTable: undefined };
    },

    toSql() {
      if (!this._toInsertValue) {
        throw new Error("Insert values are not set");
      }

      if (!this._intoTable) {
        throw new Error("Into table is not set");
      }

      const columns =
        this._columnNames.length > 0
          ? this._columnNames
          : Array.isArray(this._toInsertValue)
          ? this._toInsertValue[0].map(({ columnName }) => columnName)
          : [];

      return sql.join(
        [
          this._cteValue ? this._cteValue : null,
          sql`INSERT`,
          this._orReplaceValue
            ? sql`OR ${sql.raw(this._orReplaceValue)}`
            : null,
          sql`INTO`,
          this._intoTable,
          columns.length > 0
            ? sql`(${sql.join(columns.map((c) => sql.liter(c)))})`
            : null,
          isValues(this._toInsertValue) || isSelect(this._toInsertValue)
            ? this._toInsertValue
            : sql`VALUES ${sql.join(
                this._toInsertValue.map((toInsertColumns) => {
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
          this._returningValue,
        ].filter((v) => v),
        " "
      );
    },
  };
};
