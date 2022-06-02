import { useQuery, useQueryFirstRow, useSql } from "@trong/react-queries-hooks";
import { empty, sql, table } from "@trong/sql";
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
    sql`SELECT * FROM ${notesTable} ${
      textToSearch ? sql`WHERE content LIKE ${"%" + textToSearch + "%"}` : empty
    }`
  );

  const countResult = useQueryFirstRow<{ count: number }>(
    sql`SELECT count(*) as count FROM (${baseSql})`
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
