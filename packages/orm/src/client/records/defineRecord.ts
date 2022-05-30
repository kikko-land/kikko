import { tableSymbol } from "../../Sql";
import {
  insertRecordsMiddleware,
  selectRecordsMiddleware,
} from "./defaultMiddlewares";
import { IMiddleware } from "./middlewares";

export interface IRecordConfig<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
> {
  table: string;
  serialize: (rec: Rec) => Row;
  deserialize: (row: Row) => Rec;
  middlewares: IMiddleware<Row, Rec>[];
  [tableSymbol]: string;
}

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export function defineRecord<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>(
  config: Optional<IRecordConfig<Row, Rec>, "middlewares" | typeof tableSymbol>
): IRecordConfig<Row, Rec> {
  return {
    ...config,
    middlewares: [
      ...(config.middlewares || []),
      insertRecordsMiddleware as IMiddleware<Row, Rec>,
      selectRecordsMiddleware as IMiddleware<Row, Rec>,
    ],
    [tableSymbol]: config.table,
  };
}
