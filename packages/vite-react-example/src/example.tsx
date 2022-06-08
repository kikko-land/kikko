import { like, select, where } from "@trong-orm/query-builder";
import {
  useQuery,
  useQueryFirstRow,
  useSql,
} from "@trong-orm/react-queries-hooks";
import { empty, sql, table } from "@trong-orm/sql";
import { useState } from "react";

const notesTable = table("notes");

export const List = () => {
  const [textToSearch, setTextToSearch] = useState<string>("");

  const baseSql = useSql(
    sql`SELECT * FROM ${notesTable} ${
      textToSearch ? sql`WHERE content LIKE ${"%" + textToSearch + "%"}` : empty
    }`
  );

  const { data: recordsData } = useQuery<{
    id: string;
    title: string;
    content: string;
  }>(
    select()
      .from(notesTable)
      .where(
        textToSearch
          ? where({ content: like("%" + textToSearch + "%") })
          : empty
      )
      .toSql()
  );

  const countResult = useQueryFirstRow<{ count: number }>(
    select({ count: sql`COUNT(*)` })
      .from(baseSql)
      .toSql()
  );

  return (
    <>
      Total found records:{" "}
      {countResult.data !== undefined ? countResult.data.count : "Loading..."}
      <br />
      <br />
      <input
        value={textToSearch}
        onChange={(e) => {
          setTextToSearch(e.target.value);
        }}
        placeholder="Search content"
      />
      <br />
      {recordsData.map(({ title, content, id }) => (
        <div key={id}>
          <h1>{title}</h1>
          <div>{content}</div>
        </div>
      ))}
    </>
  );
};
