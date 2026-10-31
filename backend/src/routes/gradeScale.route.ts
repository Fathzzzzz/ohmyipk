import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const gradeScaleRouter = Router();
gradeScaleRouter.use(requireAuth);

gradeScaleRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.gradeScale.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({
      scale: rows.map((r) => ({ letter: r.letter, weight: r.weight, sortOrder: r.sortOrder })),
    });
  }),
);