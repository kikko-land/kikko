export interface IOrReplaceState {
  orReplaceValue?: "ABORT" | "FAIL" | "IGNORE" | "REPLACE" | "ROLLBACK";

  orAbort: typeof orAbort;
  orFail: typeof orFail;
  orIgnore: typeof orIgnore;
  orReplace: typeof orReplace;
  orRollback: typeof orRollback;
}

export function orAbort<T extends IOrReplaceState>(this: T): T {
  return { ...this, orReplaceValue: "ABORT" };
}

export function orFail<T extends IOrReplaceState>(this: T): T {
  return { ...this, orReplaceValue: "FAIL" };
}

export function orIgnore<T extends IOrReplaceState>(this: T): T {
  return { ...this, orReplaceValue: "IGNORE" };
}

export function orReplace<T extends IOrReplaceState>(this: T): T {
  return { ...this, orReplaceValue: "REPLACE" };
}

export function orRollback<T extends IOrReplaceState>(this: T): T {
  return { ...this, orReplaceValue: "ROLLBACK" };
}
