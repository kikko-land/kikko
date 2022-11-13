export const getTime =
  // @ts-ignore
  typeof performance !== "undefined"
    ? // @ts-ignore
      () => performance.now()
    : () => Date.now();
