import { ZodError } from 'zod';

import { captureException } from './observability';

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RouteHandler = (req: Request, ctx?: unknown) => Promise<Response>;

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const detail = err.issues
          .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
          .join('; ');
        return Response.json({ error: `Invalid request: ${detail}` }, { status: 400 });
      }

      // Unexpected error → 500. Attach an id so the accountant can quote it and
      // we can find the matching server log / Sentry event. Log with request
      // context (method + path) instead of a bare stack, then forward to Sentry
      // if it's configured (no-op otherwise).
      const errorId = crypto.randomUUID();
      const method = req.method;
      const path = (() => {
        try {
          return new URL(req.url).pathname;
        } catch {
          return req.url;
        }
      })();
      console.error(`[500] errorId=${errorId} ${method} ${path}`, err);
      await captureException(err, { errorId, method, path });

      return Response.json(
        { error: 'Internal server error', errorId },
        { status: 500 },
      );
    }
  };
}
