import { IDbState } from "@kikko-land/kikko";

export const getReactiveState = (state: IDbState) => {
  const reactiveState = state.sharedState.reactiveQueriesState;

  if (!reactiveState) {
    throw new Error(
      "Internal error, maybe you forget to connect the 'reactiveQueries' plugin?"
    );
  }

  return reactiveState;
};
