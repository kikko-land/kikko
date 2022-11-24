import {
  select,
  like$,
  sql,
  insert,
  deleteFrom,
} from '@kikko-land/query-builder';
import {
  useQuery,
  useQueryFirstRow,
  useRunQuery,
  runQuery,
  makeId,
} from '@kikko-land/react';
import React, {useState} from 'react';
import {
  useColorScheme,
  StyleSheet,
  Button,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  View,
  FlatList,
  TextInput,
} from 'react-native';
import {Colors} from 'react-native/Libraries/NewAppScreen';
import {LoremIpsum} from 'lorem-ipsum';
import Highlighter from 'react-native-highlight-words';

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

const notesTable = sql.table('notes');

type INoteRow = {
  id: string;
  title: string;
  content: string;
};

const Item = ({item, textToSearch}: {item: INoteRow; textToSearch: string}) => {
  return (
    <View style={styles.item}>
      <Text style={styles.title}>{item.title}</Text>
      <Highlighter
        highlightStyle={styles.highlight}
        searchWords={[textToSearch]}
        textToHighlight={item.content}
      />
    </View>
  );
};

export const Screen = () => {
  const [textToSearch, setTextToSearch] = useState<string>('');

  const noteRowsResult = useQuery<INoteRow>(
    select()
      .from(notesTable)
      .where(
        textToSearch ? {content: like$('%' + textToSearch + '%')} : sql.empty,
      ),
  );

  const notesCountResult = useQueryFirstRow<{count: number}>(
    select({count: sql`COUNT(*)`}).from(notesTable),
  );

  const [createNotes, createNotesState] = useRunQuery(
    db => async (count: number) => {
      runQuery(
        db,
        insert(
          Array.from(Array(count).keys()).map(() => ({
            id: makeId(),
            title: lorem.generateWords(4),
            content: lorem.generateParagraphs(1),
          })),
        ).into(notesTable),
      );
    },
  );

  const [deleteAll, deleteAllState] = useRunQuery(db => async () => {
    await runQuery(db, deleteFrom(notesTable));
  });

  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  const renderItem = ({item}: {item: INoteRow}) => (
    <Item item={item} textToSearch={textToSearch} />
  );

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}>
        {notesCountResult.data && (
          <Text>Total notes:{notesCountResult.data.count}</Text>
        )}

        <TextInput
          style={styles.input}
          onChangeText={val => setTextToSearch(val)}
          value={textToSearch}
        />

        <View
          style={{
            backgroundColor: isDarkMode ? Colors.black : Colors.white,
          }}>
          {[50, 100, 1000].map(count => (
            <Button
              key={count}
              disabled={createNotesState.type === 'running'}
              onPress={() => {
                createNotes(count);
              }}
              title={
                createNotesState.type === 'running'
                  ? 'Adding...'
                  : `Add ${count} notes`
              }
              color="#841584"
            />
          ))}
          <Button
            disabled={deleteAllState.type === 'running'}
            onPress={() => {
              deleteAll();
            }}
            title="Delete all notes"
            color="red"
          />

          {noteRowsResult.type === 'loaded' &&
            noteRowsResult.data.length === 0 && <Text>No data found</Text>}
          <FlatList
            data={noteRowsResult.data}
            renderItem={renderItem}
            keyExtractor={item => item.id}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  item: {
    marginTop: 20,
  },
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
    backgroundColor: 'yellow',
  },
});
