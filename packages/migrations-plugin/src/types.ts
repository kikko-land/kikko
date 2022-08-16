import { IDbState } from "@kikko-land/kikko";

export type IMigration = {
  up: (state: IDbState) => Promise<void>;
  id: number;
  name: string;
};
