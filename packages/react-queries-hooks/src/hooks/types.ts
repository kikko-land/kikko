export type DistributiveOmit<
  T,
  K extends keyof Record<string, unknown>
> = T extends unknown ? Omit<T, K> : never;

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
  | IHookQueryResult<D>
  | { type: "idle"; data?: D };

export type IHookQueryResult<D> =
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

export type IHookQueryResultWithIdle<D> =
  | IHookQueryResult<D>
  | { type: "idle"; data: D[] };

export type Falsy = false | 0 | "" | null | undefined;
