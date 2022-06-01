export type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export type ISingleQueryResult<D> =
  | {
      type: "loading";
      data?: D;
    }
  | {
      type: "waitingDb";
      data?: D;
    }
  | { type: "loaded"; data: D }
  | { type: "noSqlPresent"; data?: D };

export type ISingleQueryResultWithIdle<D> =
  | IQueryResult<D>
  | { type: "idle"; data?: D };

export type IQueryResult<D> =
  | {
      type: "loading";
      data: D[];
    }
  | {
      type: "waitingDb";
      data: D[];
    }
  | { type: "loaded"; data: D[] }
  | { type: "noSqlPresent"; data: D[] };

export type IQueryResultWithIdle<D> =
  | IQueryResult<D>
  | { type: "idle"; data: D[] };

export type Falsy = false | 0 | "" | null | undefined;
