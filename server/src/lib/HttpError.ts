export interface ErrorDetail {
  field: string;
  message: string;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: ErrorDetail[]
  ) {
    super(message);
  }

  static badRequest = (message = 'Bad request', details?: ErrorDetail[]) => new HttpError(400, message, details);
  static unauthorized = (message = 'Please log in to continue') => new HttpError(401, message);
  static notFound = (message = 'Not found') => new HttpError(404, message);
  static conflict = (message = 'Already exists') => new HttpError(409, message);
}
