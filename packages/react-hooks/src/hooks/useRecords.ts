import { getRecords$, Sql, withSuppressedLog } from "@anlamli/orm";
import { useEffect, useMemo, useState } from "react";

import { useDbState } from "../DbProvider";
import { DistributiveOmit, IQueryResult } from "./types";

export function useRecords<D>(
  _query: Sql,
  _opts?: { suppressLog?: boolean } | undefined
): IQueryResult<D[]> {
  const dbState = useDbState();

  const { suppressLog } = {
    suppressLog: _opts?.suppressLog !== undefined ? _opts.suppressLog : false,
  };

  const [currentQuery, setCurrentQuery] = useState<Sql>(_query);
  const [data, setData] = useState<D[] | undefined>();
  const [response, setResponse] = useState<
    DistributiveOmit<IQueryResult<D[]>, "data">
  >(
    dbState.type === "initialized" ? { type: "loading" } : { type: "waitingDb" }
  );

  useEffect(() => {
    if (dbState.type !== "initialized") {
      setResponse({ type: "waitingDb" });

      return;
    }

    const db = suppressLog ? withSuppressedLog(dbState.db) : dbState.db;

    const subscription = getRecords$(db, currentQuery).subscribe((result) => {
      setData(result as unknown as D[]);
      setResponse({ type: "loaded" });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dbState, currentQuery, suppressLog]);

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
