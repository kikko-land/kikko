import { IDb } from "@kikko-land/kikko";

export const getReactiveState = (db: IDb) => {
  const reactiveState = db.__state.sharedState.reactiveQueriesState;

  if (!reactiveState) {
    throw new Error(
      "Internal error, maybe you forget to connect the 'reactiveQueries' plugin?"
    );
  }

  return reactiveState;
};
