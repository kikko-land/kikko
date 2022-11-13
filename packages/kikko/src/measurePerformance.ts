export const getTime =
  typeof performance !== "undefined" && performance?.now
    ? () => performance.now()
    : () => Date.now();
