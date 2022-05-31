// Code is taken and adopted from https://github.com/blakeembrey/sql-template-tag

export type Value = string | number | null;
export type RawValue = Value | Sql | IContainsTable;

export const tableSymbol: unique symbol = Symbol("table");

export interface ITableDef {
  name: string;
}

export interface IContainsTable {
  [tableSymbol]: ITableDef;
}

const insertRegex = /insert\s+(or\s+\w+\s+)?into\s+/gim;
const deleteRegex = /delete\s+from\s+/gim;
const updateRegex = /update\s+(or\s+\w+\s+)?/gim;

export function containsTable(x: any): x is IContainsTable {
  return typeof x === "object" && x !== null && x[tableSymbol];
}

/**
 * A SQL instance can be nested within each other to build SQL strings.
 */
export class Sql {
  values: Value[];
  strings: string[];
  tables: ITableDef[];

  constructor(
    rawStrings: ReadonlyArray<string>,
    rawValues: ReadonlyArray<RawValue>
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
        (value instanceof Sql
          ? value.values.length
          : containsTable(value)
          ? 0
          : 1),
      0
    );
    const tablesLength = rawValues.reduce<number>(
      (len, value) =>
        len +
        (value instanceof Sql
          ? value.tables.length
          : containsTable(value)
          ? 1
          : 0),
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
      if (child instanceof Sql) {
        // Append child prefix text to current string.
        this.strings[pos] += child.strings[0];

        let childIndex = 0;
        while (childIndex < child.values.length) {
          this.values[pos++] = child.values[childIndex++];
          this.strings[pos] = child.strings[childIndex];
        }

        // Append raw string to current string.
        this.strings[pos] += rawString;
      } else if (containsTable(child)) {
        this.strings[pos] += child[tableSymbol].name + rawString;

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

    return value;
  }

  get sql() {
    let i = 1,
      value = this.strings[0];
    while (i < this.strings.length) value += `?${this.strings[i++]}`;
    return value;
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

  inspect() {
    return {
      text: this.text,
      sql: this.sql,
      values: this.values,
      tables: this.tables,
    };
  }
}

/**
 * Create a SQL query for a list of values.
 */
export function join(
  values: RawValue[],
  separator = ",",
  prefix = "",
  suffix = ""
) {
  if (values.length === 0) {
    throw new TypeError(
      "Expected `join([])` to be called with an array of multiple elements, but got an empty array"
    );
  }

  return new Sql(
    [prefix, ...Array(values.length - 1).fill(separator), suffix],
    values
  );
}

/**
 * Create raw SQL statement.
 */
export function raw(value: string) {
  return new Sql([value], []);
}

export function table(name: string): IContainsTable {
  return { [tableSymbol]: { name } };
}

/**
 * Placeholder value for "no text".
 */
export const empty = raw("");

/**
 * Create a SQL object from a template string.
 */
export function sql(strings: ReadonlyArray<string>, ...values: RawValue[]) {
  return new Sql(strings, values);
}
