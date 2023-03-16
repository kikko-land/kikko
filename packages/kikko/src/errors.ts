export class QueryRunError extends Error {
  constructor(
    initialError: Error,
    public dbName: string,
    public queries: string[]
  ) {
    super(initialError.message, { cause: initialError });
    this.cause = initialError;
    this.stack = initialError.stack;
    this.name = "QueryRunError";
  }
}
