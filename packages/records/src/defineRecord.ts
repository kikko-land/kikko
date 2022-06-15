import { IContainsTable, ITableDef, tableSymbol } from "@trong-orm/sql";

import {
  deleteRecordsMiddleware,
  insertRecordsMiddleware,
  selectRecordsMiddleware,
  updateRecordsMiddleware,
} from "./defaultMiddlewares";
import {
  ICreateMiddleware,
  IDeleteMiddleware,
  IGetMiddleware,
  IMiddlewareSlice,
  IUpdateMiddleware,
} from "./middlewares";

export interface IRecordConfig<
  Row extends object & { id: string },
  Rec extends object & { id: string }
> extends IContainsTable {
  serialize: (rec: Rec) => Row;
  deserialize: (row: Row) => Rec;
  middlewares: {
    create: ICreateMiddleware<Row, Rec>[];
    update: IUpdateMiddleware<Row, Rec>[];
    delete: IDeleteMiddleware<Row, Rec>[];
    get: IGetMiddleware<Row, Rec>[];
  };
  table: ITableDef;
  [tableSymbol]: ITableDef;
}

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export function middlewaresSlice<
  Row extends object & { id: string },
  Rec extends object & { id: string }
>(args: IMiddlewareSlice<Row, Rec>) {
  return args;
}

export function defineRecord<
  Row extends object & { id: string },
  Rec extends object & { id: string }
>(
  table: IContainsTable,
  config: Optional<
    IRecordConfig<Row, Rec>,
    "middlewares" | typeof tableSymbol | "table"
  > & {
    middlewareSlices?: IMiddlewareSlice<Row, Rec>[];
    plugins?: ((config: IRecordConfig<Row, Rec>) => IRecordConfig<Row, Rec>)[];
  }
): IRecordConfig<Row, Rec> {
  const createMiddlewares: ICreateMiddleware<Row, Rec>[] = [
    insertRecordsMiddleware<Row, Rec>(),
  ];
  const updateMiddlewares: IUpdateMiddleware<Row, Rec>[] = [
    updateRecordsMiddleware<Row, Rec>(),
  ];
  const deleteMiddlewares: IDeleteMiddleware<Row, Rec>[] = [
    deleteRecordsMiddleware<Row, Rec>(),
  ];
  const getMiddlewares: IGetMiddleware<Row, Rec>[] = [
    selectRecordsMiddleware<Row, Rec>(),
  ];

  const middlewares = config.middlewareSlices?.slice().reverse() || [];

  for (const middlewareSlice of middlewares) {
    if (middlewareSlice.create) {
      createMiddlewares.unshift(middlewareSlice.create);
    }
    if (middlewareSlice.update) {
      updateMiddlewares.unshift(middlewareSlice.update);
    }
    if (middlewareSlice.delete) {
      deleteMiddlewares.unshift(middlewareSlice.delete);
    }
    if (middlewareSlice.get) {
      getMiddlewares.unshift(middlewareSlice.get);
    }
  }

  let finalConfig: IRecordConfig<Row, Rec> = {
    ...config,
    ...table,
    get table() {
      return this[tableSymbol];
    },
    middlewares: {
      create: createMiddlewares,
      update: updateMiddlewares,
      delete: deleteMiddlewares,
      get: getMiddlewares,
    },
  };

  for (const plugin of config?.plugins || []) {
    finalConfig = plugin(finalConfig);
  }

  return finalConfig;
}
