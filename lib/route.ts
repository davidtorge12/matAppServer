import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";

/**
 * Wraps an async handler so a rejected promise reaches Express's error handler
 * instead of hanging the request. Replaces the identical try/catch that was
 * copied into every route.
 */
type RouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => unknown | Promise<unknown>;

export function route(handler: RouteHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/** Thrown by handlers to answer with a specific status instead of a 500. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message);
}

export function notFound(message: string): HttpError {
  return new HttpError(404, message);
}

/** Terminal error handler: logs the cause, returns a message safe to show. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = error instanceof HttpError ? error.status : 500;

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    // Internal failures must not leak a stack trace or a Mongo error string to
    // the browser; client errors carry the message the handler chose.
    error:
      status >= 500
        ? "internal server error"
        : error instanceof HttpError
          ? error.message
          : "internal server error",
  });
};
