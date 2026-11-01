export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly publicMessage: string,
    public readonly fields?: ReadonlyArray<{ path: string; code: string }>,
    public readonly retryAfterSeconds?: number,
  ) {
    super(publicMessage);
    this.name = "ApiError";
  }
}
