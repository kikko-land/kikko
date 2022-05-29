import { insertRecordMiddleware } from "./defaultMiddlewares";
import { IMiddleware } from "./middlewares";

export interface IRecordConfig<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
> {
  table: string;
  serialize: (rec: Rec) => Row;
  deserialize: (row: Row) => Rec;
  middlewares: IMiddleware<Row, Rec>[];
}

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export function createRecordConfig<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>(
  config: Optional<IRecordConfig<Row, Rec>, "middlewares">
): IRecordConfig<Row, Rec> {
  return {
    ...config,
    middlewares: [
      ...(config.middlewares || []),
      insertRecordMiddleware as IMiddleware<Row, Rec>,
    ],
  };
}
