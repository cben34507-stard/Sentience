import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  try {
    return schema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) {
      throw new HttpError(400, e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
    }
    throw e;
  }
}

type Handler = (req: Request, res: Response) => Promise<unknown> | unknown;

/** Wraps an async handler so thrown errors reach the error middleware. */
export const wrap =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res))
      .then((result) => {
        if (!res.headersSent && result !== undefined) res.json(result);
      })
      .catch(next);
  };

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: err instanceof Error ? err.message : "internal error" });
}
