export const tableSymbol: unique symbol = Symbol("table");

export interface ITableDef {
  name: string;
  dependsOnTables: ITableDef[];
  __discriminator: "ITableDef";
  allDependingTables: ITableDef[];
}

export interface IContainsTable {
  [tableSymbol]: ITableDef;
}

export const table = (
  name: string,
  dependsOnTables?: ITableDef[]
): ITableDef & IContainsTable => {
  return {
    name,
    dependsOnTables: dependsOnTables || [],
    get allDependingTables() {
      const tableDefs: ITableDef[] = [];

      this.dependsOnTables.forEach((def) => {
        tableDefs.push(...def.allDependingTables);
      });

      return tableDefs;
    },
    get [tableSymbol]() {
      return this;
    },




    __discriminator: "ITableDef",
  };
};

export function isTable(x: unknown): x is IContainsTable {
  if (x === null) return false;
  if (x === undefined) return false;
  if (typeof x !== "object") return false;

  return x.hasOwnProperty(tableSymbol);
}
