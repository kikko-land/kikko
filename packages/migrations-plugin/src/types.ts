import { IDb } from "@kikko-land/kikko";

export type IMigration = {
  up: (state: IDb) => Promise<void>;
  id: number;
  name: string;
};
