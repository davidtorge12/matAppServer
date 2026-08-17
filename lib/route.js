/**
 * Wraps an async handler so a rejected promise reaches Express's error handler
 * instead of hanging the request. Replaces the identical try/catch that was
 * copied into every route.
 */
export function route(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/** Thrown by handlers to answer with a specific status instead of a 500. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function badRequest(message) {
  return new HttpError(400, message);
}

export function notFound(message) {
  return new HttpError(404, message);
}

/** Terminal error handler: logs the cause, returns a message safe to show. */
export function errorHandler(error, _req, res, _next) {
  const status = error instanceof HttpError ? error.status : 500;

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    // Internal failures must not leak a stack trace or a Mongo error string to
    // the browser; client errors carry the message the handler chose.
    error: status >= 500 ? "internal server error" : error.message,
  });
}
