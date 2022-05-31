import { BroadcastChannel } from "broadcast-channel";
import {
  first,
  lastValueFrom,
  Observable,
  ReplaySubject,
  share,
  switchMap,
  takeUntil,
} from "rxjs";

import { IDbState } from "./types";

export const chunk = <T>(array: Array<T>, chunkSize: number): T[][] =>
  Array(Math.ceil(array.length / chunkSize))
    .fill(null)
    .map((_, index) => index * chunkSize)
    .map((begin) => array.slice(begin, begin + chunkSize));
