import { IDbState } from "./types";

export const suppressLog = <T>(
  state: IDbState,
  func: (state: IDbState) => T
): T => {
  return func({ ...state, suppressLog: true });
};

export const withSuppressedLog = (state: IDbState): IDbState => {
  return { ...state, suppressLog: true };
};
