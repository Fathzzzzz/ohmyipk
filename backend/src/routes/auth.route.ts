import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { env } from '../config.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { getMe, login, register } from '../services/auth.service.js';

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});
const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1).max(120),
});

function setTokenCookie(res: Response, token: string): void {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = validate(registerSchema, req.body);
    const { user, token } = await register(data.email, data.password, data.name);
    setTokenCookie(res, token);
    res.status(201).json({ user });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = validate(credentialsSchema, req.body);
    const { user, token } = await login(data.email, data.password);
    setTokenCookie(res, token);
    res.json({ user });
  }),
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(env.cookieName, { httpOnly: true, sameSite: 'lax', path: '/' });
  res.json({ ok: true });
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: await getMe(req.userId!) });
  }),
);