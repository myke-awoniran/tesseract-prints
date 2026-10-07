export type ErrorDetails = Record<string, string> | string[];

export class HttpError extends Error {
  readonly statusCode: number;
  readonly details?: ErrorDetails;

  constructor(statusCode: number, message: string, details?: ErrorDetails) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: ErrorDetails) => new HttpError(400, message, details);
export const unauthorized = (message = 'Sign in to continue.') => new HttpError(401, message);
export const notFound = (message = 'We could not find that.') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
export const gone = (message: string) => new HttpError(410, message);
