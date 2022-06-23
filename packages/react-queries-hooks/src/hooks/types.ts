export type DistributiveOmit<
  T,
  K extends keyof Record<string, unknown>
> = T extends unknown ? Omit<T, K> : never;

export type ISingleQueryHookResult<D> =
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

export type IRunQueryHookResult<D> =
  | {
      type: "running";
      data?: D;
    }
  | {
      type: "waitingDb";
      data?: D;
    }
  | { type: "done"; data: D }
  | { type: "idle"; data?: D };

export type IQueryHookResult<D> =
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

export type Falsy = false | 0 | "" | null | undefined;
