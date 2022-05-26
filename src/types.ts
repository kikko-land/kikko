export type IMigration = {
  up: (db: IQueryExecuter) => Promise<void>;
  id: number;
  name: string;
};
