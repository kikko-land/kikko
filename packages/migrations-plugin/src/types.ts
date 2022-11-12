import { IAtomicTransactionScope, IDb } from "@kikko-land/kikko";

export type IMigration = {
  up: (state: IDb) => Promise<void>;
  id: number;
  name: string;
};

export type IAtomicMigration = {
  up: (tr: IAtomicTransactionScope, db: IDb) => Promise<void> | void;
  id: number;
  name: string;
};
