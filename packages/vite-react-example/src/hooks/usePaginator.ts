import { ISelectStatement, select } from "@kikko-land/query-builder";
import { sql, useQueryFirstRow } from "@kikko-land/react";
import { useCallback, useEffect, useState } from "react";

export const usePaginator = ({
  perPage,
  baseQuery,
}: {
  perPage: number;
  baseQuery: ISelectStatement;
}) => {
  const [currentPage, setPage] = useState(1);

  const countResult = useQueryFirstRow<{ count: number }>(
    select({ count: sql`COUNT(*)` }).from(baseQuery)
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
    paginatedQuery: baseQuery
      .limit(perPage)
      .offset(perPage * (currentPage - 1)),
    totalPages,
    currentPage,
    totalCount,
    isNextPageAvailable,
    isPrevPageAvailable,
    nextPage,
    prevPage,
  };
};
