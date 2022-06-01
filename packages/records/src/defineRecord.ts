import { IContainsTable, TableDef, tableSymbol } from "@trong/sql";

import {
  deleteRecordsMiddleware,
  insertRecordsMiddleware,
  selectRecordsMiddleware,
} from "./defaultMiddlewares";
import { IMiddleware } from "./middlewares";

export interface IRecordConfig<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
> extends IContainsTable {
  serialize: (rec: Rec) => Row;
  deserialize: (row: Row) => Rec;
  middlewares: IMiddleware<Row, Rec>[];
  table: TableDef;
  [tableSymbol]: TableDef;
}

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export function defineRecord<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>(
  table: IContainsTable,
  config: Optional<
    IRecordConfig<Row, Rec>,
    "middlewares" | typeof tableSymbol | "table"
  >
): IRecordConfig<Row, Rec> {
  return {
    ...config,
    ...table,
    get table() {
      return this[tableSymbol];
    },
    middlewares: [
      ...(config.middlewares || []),
      insertRecordsMiddleware as IMiddleware<Row, Rec>,
      selectRecordsMiddleware as IMiddleware<Row, Rec>,
      deleteRecordsMiddleware as IMiddleware<Row, Rec>,
    ],
  };
}
