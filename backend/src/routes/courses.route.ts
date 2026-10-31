import { Router } from 'express';
import { z } from 'zod';
import { GRADE_LETTERS } from '../calc/index.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { notFound } from '../lib/httpError.js';
import { prisma } from '../lib/prisma.js';
import { validate } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';

export const coursesRouter = Router();
coursesRouter.use(requireAuth);

const updateCourseSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  credits: z.number().int().min(1).max(30).optional(),
  grade: z.enum(GRADE_LETTERS).nullable().optional(),
});

async function findOwnedCourse(id: string, userId: string) {
  return prisma.course.findFirst({ where: { id, semester: { plan: { userId } } } });
}

coursesRouter.patch(
  '/:courseId',
  asyncHandler(async (req, res) => {
    const existing = await findOwnedCourse(req.params.courseId, req.userId!);
    if (!existing) throw notFound('Course not found');
    const data = validate(updateCourseSchema, req.body);
    const course = await prisma.course.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.credits !== undefined ? { credits: data.credits } : {}),
        ...(data.grade !== undefined ? { grade: data.grade } : {}),
      },
    });
    res.json({ course });
  }),
);

coursesRouter.delete(
  '/:courseId',
  asyncHandler(async (req, res) => {
    const existing = await findOwnedCourse(req.params.courseId, req.userId!);
    if (!existing) throw notFound('Course not found');
    await prisma.course.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);