import {
  defineRecord,
  middlewaresSlice,
  runAfterTransactionCommitted,
  sql,
} from "@trong-orm/react";

export interface INoteRow {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface INoteRecord {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export const notesRecords = defineRecord<INoteRow, INoteRecord>(
  sql.table("notes"),
  {
    serialize: (record) => ({
      ...record,
      createdAt: record.createdAt.getTime(),
      updatedAt: record.updatedAt.getTime(),
    }),
    deserialize: (row) => ({
      ...row,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    }),
    middlewareSlices: [
      middlewaresSlice({
        delete: async (args) => {
          const { next, dbState } = args;

          const res = await next(args);

          runAfterTransactionCommitted(dbState, () => {
            console.log({ deletedRecords: res.result.deletedRecords });
          });

          return res;
        },
      }),
    ],
  }
);
