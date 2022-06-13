import { useQueryFirstRow } from "@trong-orm/react-queries-hooks";
import { sql } from "@trong-orm/sql";
import { useCallback, useEffect, useState } from "react";

export const usePaginator = ({
  perPage,
  baseSql,
}: {
  perPage: number;
  baseSql: ISelectQueryBuilder;
}) => {
  const [currentPage, setPage] = useState(1);

  const countResult = useQueryFirstRow<{ count: number }>(
    sql`SELECT count(*) as count FROM (${baseSql})`
  );

  const totalCount = countResult.data?.count;

  const totalPages =
    totalCount !== undefined ? Math.ceil(totalCount / perPage) || 1 : undefined;

  useEffect(() => {
    if (totalPages === undefined) return;
    if (totalPages === 0) {
      setPage(1);

      return;
    }

    if (currentPage > totalPages) {
      setPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const isNextPageAvailable =
    totalPages !== undefined ? currentPage < totalPages : false;
  const isPrevPageAvailable = currentPage > 1;

  const nextPage = useCallback(() => {
    if (isNextPageAvailable) {
      setPage(currentPage + 1);
    }
  }, [currentPage, isNextPageAvailable]);

  const prevPage = useCallback(() => {
    if (isPrevPageAvailable) {
      setPage(currentPage - 1);
    }
  }, [currentPage, isPrevPageAvailable]);

  return {
    pagerSql: sql`LIMIT ${perPage} OFFSET ${perPage * (currentPage - 1)}`,
    totalPages,
    currentPage,
    totalCount,
    isNextPageAvailable,
    isPrevPageAvailable,
    nextPage,
    prevPage,
  };
};
