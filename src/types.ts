import { IDbState } from "./client/db";

export type IMigration = {
  up: (state: IDbState) => Promise<void>;
  id: number;
  name: string;
};
