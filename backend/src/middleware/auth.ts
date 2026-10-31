import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies[env.cookieName];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub?: string };
    if (typeof payload.sub !== 'string') throw new Error('missing sub');
    req.userId = payload.sub;
    next();
  } catch {
    res.clearCookie(env.cookieName, { httpOnly: true, sameSite: 'lax', path: '/' });
    res.status(401).json({ error: 'Unauthorized' });
  }
}