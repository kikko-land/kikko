import { like$, select } from "@trong-orm/query-builder";
import { sql, table, useQuery, useQueryFirstRow } from "@trong-orm/react";
import { useState } from "react";

const notesTable = table("notes");

export const List = () => {
  const [textToSearch, setTextToSearch] = useState<string>("");

  const baseSql = select()
    .from(notesTable)
    .where(
      textToSearch ? { content: like$("%" + textToSearch + "%") } : sql.empty
    );

  const { data: recordsData } = useQuery<{
    id: string;
    title: string;
    content: string;
  }>(baseSql);

  const countResult = useQueryFirstRow<{ count: number }>(
    select({ count: sql`COUNT(*)` }).from(baseSql)
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
