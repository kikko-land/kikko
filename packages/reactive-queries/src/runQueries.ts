import { IDbState, runQueries } from "@trong/core";
import { Sql } from "@trong/sql";
import { map, startWith, switchMap } from "rxjs";

import { subscribeToQueries$ } from "./subscribeToQueries";

export const runQuery$ = (state: IDbState, query: Sql) => {
  return runQueries$(state, [query]).pipe(map((list) => list[0]));
};
