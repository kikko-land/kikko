import { IDbState } from "@trong-orm/core";

export type IMigration = {
  up: (state: IDbState) => Promise<void>;
  id: number;
  name: string;
};
