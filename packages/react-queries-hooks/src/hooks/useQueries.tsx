import { ISqlAdapter } from "@kikko-land/boono-sql";
import { withSuppressedLog } from "@kikko-land/kikko";
import { IDb } from "@kikko-land/kikko";
import { listenQueries } from "@kikko-land/reactive-queries-plugin";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDbState } from "../DbProvider";
import {
  Falsy,
  IQueryHookResult,
  IRunQueryHookResult,
  ISingleQueryHookResult,
} from "./types";

type DistributiveOmit<
  T,
  K extends keyof Record<string, unknown>
> = T extends unknown ? Omit<T, K> : never;

type IOpts = { suppressLog?: boolean; mapToObject?: boolean };

export function useDbQueries<D extends Record<string, unknown>>(
  ...args:
    | [
        dbKey: string,
        _queries: ISqlAdapter[] | Falsy,
        _opts?: IOpts | undefined
      ]
    | [_queries: ISqlAdapter[] | Falsy, _opts?: IOpts | undefined]
): IQueryHookResult<D[]> {
  const { dbKey, _queries, _opts } = (() => {
    if (typeof args[0] === "string") {
      return {
        dbKey: args[0],
        _queries: args[1] as ISqlAdapter[] | Falsy,
        _opts: args[2],
      };
    } else {
      return {
        dbKey: "default",
        _queries: args[0] as ISqlAdapter[] | Falsy,
        _opts: args[1] as IOpts | undefined,
      };
    }
  })();

  const dbState = useDbState(dbKey);

  const { suppressLog } = {
    suppressLog: _opts?.suppressLog !== undefined ? _opts.suppressLog : false,
  };

  const [currentQueries, setCurrentQueries] = useState<ISqlAdapter[]>(
    _queries ? _queries : []
  );
  const [data, setData] = useState<D[][] | undefined>();
  const [response, setResponse] = useState<
    DistributiveOmit<IQueryHookResult<D[][]>, "data">
  >(
    _queries
      ? dbState.type === "initialized"
        ? { type: "loading" }
        : { type: "waitingDb" }
      : { type: "noSqlPresent" }
  );

  useEffect(() => {
    if (currentQueries.length === 0) {
      setResponse({ type: "noSqlPresent" });

      return;
    }

    if (dbState?.type !== "initialized") {
      setResponse({ type: "waitingDb" });

      return;
    }

    const db = suppressLog ? withSuppressedLog(dbState.db) : dbState.db;

    const unsub = listenQueries<D>(db, currentQueries, (result) => {
      setData(result);
      setResponse({ type: "loaded" });
    });

    return () => {
      unsub();
    };
  }, [dbState, currentQueries, suppressLog, dbKey]);

  useEffect(() => {
    if (
      currentQueries.map((q) => q.toSql().hash).join() !==
      (_queries || []).map((q) => q.toSql().hash).join()
    ) {
      setCurrentQueries(_queries || []);
    }
  }, [currentQueries, _queries]);

  return useMemo(() => {
    if (response.type === "loaded") {
      if (!data) {
        throw new Error(
          "Internal error: response state is loaded, but there is not data!"
        );
      }

      return { ...response, data };
    }

    return { ...response, data: data || [] };
  }, [data, response]);
}

export function useDbQuery<D extends Record<string, unknown>>(
  ...args:
    | [dbKey: string, query: ISqlAdapter | Falsy, _opts?: IOpts | undefined]
    | [query: ISqlAdapter | Falsy, _opts?: IOpts | undefined]
): IQueryHookResult<D> {
  const { dbKey, _query, _opts } = (() => {
    if (typeof args[0] === "string") {
      return {
        dbKey: args[0],
        _query: args[1] as ISqlAdapter | Falsy,
        _opts: args[2],
      };
    } else {
      return {
        dbKey: "default",
        _query: args[0] as ISqlAdapter | Falsy,
        _opts: args[1] as IOpts | undefined,
      };
    }
  })();

  const queries = useMemo(() => (_query ? [_query] : []), [_query]);

  const result = useDbQueries<D>(dbKey, queries, _opts);

  return useMemo(() => {
    if (result.type === "loaded") {
      if (!result.data) {
        throw new Error(
          "Internal error: response state is loaded, but there is not data!"
        );
      }

      return { ...result, data: result.data[0] || [] };
    }

    return {
      ...result,
      data: result.data?.[0] || [],
    };
  }, [result]);
}

export function useFirstRowDbQuery<D extends Record<string, unknown>>(
  ...args:
    | [dbKey: string, query: ISqlAdapter | Falsy, _opts?: IOpts | undefined]
    | [query: ISqlAdapter | Falsy, _opts?: IOpts | undefined]
): ISingleQueryHookResult<D> {
  const res = useDbQuery<D>(...args);

  return useMemo(() => {
    if (res.type === "loaded") {
      return { ...res, data: res.data[0] };
    }

    return { ...res, data: res.data?.[0] };
  }, [res]);
}

function useIsMounted() {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  return useCallback(() => isMounted.current, []);
}

type IRunOpts = { suppressLog?: boolean; inTransaction?: boolean };
export function useRunDbQuery<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  D extends (db: IDb) => (...args: any[]) => Promise<R>,
  R
>(
  ...args:
    | [dbKey: string, cb: D, _opts?: IRunOpts | undefined]
    | [cb: D, _opts?: IRunOpts | undefined]
): readonly [
  (...args: Parameters<ReturnType<D>>) => Promise<R>,
  IRunQueryHookResult<R>
] {
  const { dbKey, cb, _opts } = (() => {
    if (typeof args[0] === "string") {
      return {
        dbKey: args[0],
        cb: args[1] as D,
        _opts: args[2],
      };
    } else {
      return {
        dbKey: "default",
        cb: args[0],
        _opts: args[1] as IRunOpts | undefined,
      };
    }
  })();

  const { suppressLog, inTransaction } = {
    suppressLog: _opts?.suppressLog !== undefined ? _opts.suppressLog : false,
    inTransaction:
      _opts?.inTransaction !== undefined ? _opts.inTransaction : false,
  };

  const dbState = useDbState(dbKey);
  const isMounted = useIsMounted();

  const [data, setData] = useState<R>();
  const [runStateType, setRunStateType] = useState<
    IRunQueryHookResult<R>["type"]
  >(dbState.type === "initialized" ? "idle" : "waitingDb");

  useEffect(() => {
    if (dbState.type === "initialized") {
      setRunStateType("idle");
    } else {
      setRunStateType("waitingDb");
    }
  }, [dbState.type]);

  const toCall = useCallback(
    async (...args: Parameters<ReturnType<D>>) => {
      if (dbState.type !== "initialized") {
        // TODO: maybe wait db init as opts?

        throw new Error("Db not initialized!");
      }

      setRunStateType("running");

      const db = suppressLog ? withSuppressedLog(dbState.db) : dbState.db;
      const res = await (inTransaction
        ? db.runInTransaction((db) => cb(db)(...args))
        : cb(db)(...args));

      if (isMounted()) {
        setData(res);
        setRunStateType("done");
      }

      return res;
    },
    [cb, dbState, inTransaction, isMounted, suppressLog]
  );

  // Simulation of useEvent
  const toCallRef =
    useRef<(...args: Parameters<ReturnType<D>>) => Promise<R>>(toCall);
  useEffect(() => {
    toCallRef.current = toCall;
  }, [toCall]);

  const run = useCallback((...args: Parameters<ReturnType<D>>) => {
    return toCallRef.current(...args);
  }, []);

  const result = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return { type: runStateType, data: data! };
  }, [data, runStateType]);

  return [run, result];
}

export function useCacheDbQuery<T extends ISqlAdapter>(_query: T): T {
  const [query, setQuery] = useState(_query);

  useEffect(() => {
    if (query.toSql().hash !== _query.toSql().hash) {
      setQuery(_query);
    }
  }, [_query, query]);

  return query;
}
