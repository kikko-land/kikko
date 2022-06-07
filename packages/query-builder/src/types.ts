export const hasDiscriminator = (
  x: unknown
): x is { __discriminator: string } => {
  return x !== null && typeof x === "object" && "__discriminator" in x;
};
