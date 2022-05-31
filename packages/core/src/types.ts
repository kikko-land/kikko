import { IDbState } from "./client/types";

export type IMigration = {
  up: (state: IDbState) => Promise<void>;
  id: number;
  name: string;
};
