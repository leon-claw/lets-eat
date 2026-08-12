export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429;

export class ApiError extends Error {
  constructor(
    readonly status: ApiErrorStatus,
    readonly code: string,
    message: string,
    readonly latest?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
