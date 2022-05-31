import {
  getRecords,
  IDbState,
  IRecordConfig,
  withSuppressedLog,
} from "@trong/core";
import { subscribeToQueries$ } from "@trong/reactive-queries";
import { Sql } from "@trong/sql";
import { useEffect, useMemo, useState } from "react";
import { startWith, switchMap, takeUntil } from "rxjs";

import { useDbState } from "../DbProvider";
import { DistributiveOmit, IQueryResult } from "./types";

const getRecords$ = <
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>(
  db: IDbState,
  recordConfig: IRecordConfig<Row, Rec>,
  sql: Sql
) => {
  return subscribeToQueries$(db, [sql]).pipe(
    startWith(undefined),
    switchMap(() => getRecords(db, recordConfig, sql)),
    takeUntil(db.sharedState.stop$)
  );
};

export function useRecords<
  Row extends Record<string, any> & { id: string },
  Rec extends Record<string, any> & { id: string }
>(
  recordConfig: IRecordConfig<Row, Rec>,
  _query: Sql,
  _opts?: { suppressLog?: boolean } | undefined
): IQueryResult<Rec[]> {
  const dbState = useDbState();

  const { suppressLog } = {
    suppressLog: _opts?.suppressLog !== undefined ? _opts.suppressLog : false,
  };

  const [currentQuery, setCurrentQuery] = useState<Sql>(_query);
  const [data, setData] = useState<Rec[] | undefined>();
  const [response, setResponse] = useState<
    DistributiveOmit<IQueryResult<Rec[]>, "data">
  >(
    dbState.type === "initialized" ? { type: "loading" } : { type: "waitingDb" }
  );

  useEffect(() => {
    if (dbState.type !== "initialized") {
      setResponse({ type: "waitingDb" });

      return;
    }

    const db = suppressLog ? withSuppressedLog(dbState.db) : dbState.db;

    const subscription = getRecords$(db, recordConfig, currentQuery).subscribe(
      (result) => {
        setData(result);
        setResponse({ type: "loaded" });
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [dbState, currentQuery, suppressLog, recordConfig]);

  useEffect(() => {
    if (currentQuery.hash !== _query.hash) {
      setCurrentQuery(_query);
    }
  }, [currentQuery, _query]);

  return useMemo(() => {
    if (response.type === "loaded") {
      if (!data) {
        throw new Error(
          "Internal error: response state is loaded, but there is not data!"
        );
      }

      return { ...response, data };
    }

    return { ...response, data };
  }, [data, response]);
}
