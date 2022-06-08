export const hasDiscriminator = (
  x: unknown
): x is { __discriminator: string } => {
  return x !== null && typeof x === "object" && "__discriminator" in x;
};
export function assertUnreachable(x: never): never {
  throw new Error(`Didn't expect to get here: ${JSON.stringify(x)}`);
}
