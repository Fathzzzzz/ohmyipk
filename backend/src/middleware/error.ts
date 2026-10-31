import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/httpError.js';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Prisma unique-constraint (P2002) -> 409.
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 'P2002'
  ) {
    res.status(409).json({ error: 'Duplicate value' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}