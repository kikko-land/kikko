import {
  IContainsTable,
  isTable,
  ITableDef,
  table,
  tableSymbol,
} from "./table";

// Code is taken and adopted from https://github.com/blakeembrey/sql-template-tag

export type IPrimitiveValue = string | number | null;
export const isPrimitiveValue = (t: unknown): t is IPrimitiveValue => {
  return t === null || typeof t === "string" || typeof t === "number";
};

export type IRawValue =
  | IPrimitiveValue
  | Sql
  | IContainsTable
  | { toSql(): Sql };

const insertRegex = /insert\s+(or\s+\w+\s+)?into\s+/gim;
const deleteRegex = /delete\s+from\s+/gim;
const updateRegex = /update\s+(or\s+\w+\s+)?/gim;

const strip = (str: string) => {
  return str
    .replace(/"/g, "")
    .split(".")
    .map((v) => '"' + v + '"')
    .join(".");
};

export interface ISqlAdapter {
  toSql(): Sql;
}

export function isSql(x: unknown): x is ISqlAdapter {
  if (x === null) return false;
  if (typeof x !== "object") return false;

  return "toSql" in x;
}

/**
 * A SQL instance can be nested within each other to build SQL strings.
 */
export class Sql implements ISqlAdapter {
  values: IPrimitiveValue[];
  strings: string[];
  tables: ITableDef[];

  constructor(
    rawStrings: ReadonlyArray<string>,
    rawValues: ReadonlyArray<IRawValue>
  ) {
    if (rawStrings.length - 1 !== rawValues.length) {
      if (rawStrings.length === 0) {
        throw new TypeError("Expected at least 1 string");
      }

      throw new TypeError(
        `Expected ${rawStrings.length} strings to have ${
          rawStrings.length - 1
        } values`
      );
    }

    const valuesLength = rawValues.reduce<number>(
      (len, value) =>
        len +
        (isSql(value) ? value.toSql().values.length : isTable(value) ? 0 : 1),
      0
    );
    const tablesLength = rawValues.reduce<number>(
      (len, value) =>
        len +
        (isSql(value) ? value.toSql().tables.length : isTable(value) ? 1 : 0),
      0
    );

    this.values = new Array(valuesLength);
    this.strings = new Array(valuesLength + 1);
    this.tables = new Array(tablesLength);

    this.strings[0] = rawStrings[0];

    // Iterate over rw values, strings, and children. The value is always
    // positioned between two strings, e.g. `index + 1`.
    let i = 0,
      pos = 0,
      tableI = 0;
    while (i < rawValues.length) {
      const child = rawValues[i++];
      const rawString = rawStrings[i];

      // Check for nested `sql` queries.
      if (isSql(child)) {
        const sql = child.toSql();
        // Append child prefix text to current string.
        this.strings[pos] += sql.strings[0];

        let childIndex = 0;
        while (childIndex < sql.values.length) {
          this.values[pos++] = sql.values[childIndex++];
          this.strings[pos] = sql.strings[childIndex];
        }

        let childTableIndex = 0;
        while (childTableIndex < sql.tables.length) {
          this.tables[tableI++] = sql.tables[childTableIndex++];
        }

        // Append raw string to current string.
        this.strings[pos] += rawString;
      } else if (isTable(child)) {
        this.strings[pos] += strip(child[tableSymbol].name) + rawString;

        this.tables[tableI++] = child[tableSymbol];
      } else {
        this.values[pos++] = child;
        this.strings[pos] = rawString;
      }
    }
  }

  get text() {
    let i = 1,
      value = this.strings[0];
    while (i < this.strings.length) value += `$${i}${this.strings[i++]}`;

    return value.trim();
  }

  get sql() {
    let i = 1,
      value = this.strings[0];
    while (i < this.strings.length) value += `?${this.strings[i++]}`;
    return value.trim();
  }

  get hash() {
    return this.strings.join() + this.values.join();
  }

  get isModifyQuery() {
    const query = this.sql;

    // There some edge cases could happen here, so better regex could be introduced
    // I don't want put AST parser to frontend lib
    return (
      query.match(insertRegex) !== null ||
      query.match(deleteRegex) !== null ||
      query.match(updateRegex) !== null
    );
  }

  get isReadQuery() {
    return !this.isModifyQuery;
  }

  get isEmpty() {
    return this.sql.trim().length === 0;
  }

  inspect() {
    return {
      text: this.text,
      sql: this.sql,
      values: this.values,
      tables: this.tables,
    };
  }

  toSql() {
    return this;
  }
}

export function sql(strings: ReadonlyArray<string>, ...values: IRawValue[]) {
  return new Sql(strings, values);
}

sql.raw = (value: string) => {
  return new Sql([value], []);
};
sql.liter = (str: string) => {
  return sql.raw(strip(str));
};
sql.table = table;
sql.empty = sql.raw("");
sql.join = (
  values: IRawValue[],
  separator = ", ",
  prefix = "",
  suffix = ""
) => {
  values = values.filter((v) => (isSql(v) ? !v.toSql().isEmpty : v));

  if (values.length === 0) {
    throw new TypeError(
      "Expected `join([])` to be called with an array of multiple elements, but got an empty array"
    );
  }

  return new Sql(
    [prefix, ...Array(values.length - 1).fill(separator), suffix],
    values
  );
};
