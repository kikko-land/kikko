import { IDbState } from "@kikko-land/core";

export type IMigration = {
  up: (state: IDbState) => Promise<void>;
  id: number;
  name: string;
};
