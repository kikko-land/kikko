export type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export type IQueryResult<D> =
  | {
      type: "loading";
      data?: D;
    }
  | {
      type: "waitingDb";
      data?: D;
    }
  | { type: "loaded"; data: D };

export type IQueryResultWithIdle<D> = IQueryResult<D> | { type: "idle" };
