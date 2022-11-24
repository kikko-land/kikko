import {
  deleteFrom,
  insert,
  like$,
  select,
  sql,
} from "@kikko-land/query-builder";
import {
  makeId,
  runQuery,
  useQuery,
  useQueryFirstRow,
  useRunQuery,
} from "@kikko-land/react";
import React from "react";
import { useState } from "react";
import { StyleSheet, Button, SafeAreaView, FlatList } from "react-native";
import { LoremIpsum } from "lorem-ipsum";

import { Text, View } from "../components/Themed";
import { RootTabScreenProps } from "../types";

const lorem = new LoremIpsum({
  sentencesPerParagraph: {
    max: 8,
    min: 4,
  },
  wordsPerSentence: {
    max: 16,
    min: 4,
  },
});

const notesTable = sql.table("notes");

type INoteRow = {
  id: string;
  title: string;
  content: string;
};

const Item = ({ item }: { item: INoteRow }) => {
  return (
    <>
      <Text style={styles.title}>{item.title}</Text>
      <Text>{item.content}</Text>

      <View
        style={styles.separator}
        lightColor="#eee"
        darkColor="rgba(255,255,255,0.1)"
      />
    </>
  );
};

export default function TabOneScreen({
  navigation,
}: RootTabScreenProps<"TabOne">) {
  const [textToSearch, setTextToSearch] = useState<string>("");

  const noteRowsResult = useQuery<INoteRow>(
    select()
      .from(notesTable)
      .where(
        textToSearch ? { content: like$("%" + textToSearch + "%") } : sql.empty
      )
  );

  const notesCountResult = useQueryFirstRow<{ count: number }>(
    select({ count: sql`COUNT(*)` }).from(notesTable)
  );

  const [createNotes, createNotesState] = useRunQuery(
    (db) => async (count: number) => {
      runQuery(
        db,
        insert(
          Array.from(Array(count).keys()).map((i) => ({
            id: makeId(),
            title: lorem.generateWords(4),
            content: lorem.generateParagraphs(1),
          }))
        ).into(notesTable)
      );
    }
  );

  const [deleteAll, deleteAllState] = useRunQuery((db) => async () => {
    await runQuery(db, deleteFrom(notesTable));
  });

  const renderItem = ({ item }: { item: INoteRow }) => <Item item={item} />;

  return (
    <SafeAreaView style={styles.container}>
      {noteRowsResult.type === "loaded" && noteRowsResult.data.length === 0 && (
        <Text>No data found</Text>
      )}
      <FlatList
        data={noteRowsResult.data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
      />
      {notesCountResult.data && (
        <Text>Total notes:{notesCountResult.data.count}</Text>
      )}

      {[50, 100, 1000].map((count) => (
        <Button
          key={count}
          disabled={createNotesState.type === "running"}
          onPress={() => {
            createNotes(count);
          }}
          title={
            createNotesState.type === "running"
              ? "Adding..."
              : `Add ${count} notes`
          }
          color="#841584"
        />
      ))}
      <Button
        disabled={deleteAllState.type === "running"}
        onPress={() => {
          deleteAll();
        }}
        title="Delete all notes"
        color="red"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: "80%",
  },
});
