import { Router } from 'express';
import { z } from 'zod';
import { GRADE_LETTERS } from '../calc/index.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { HttpError, notFound } from '../lib/httpError.js';
import { prisma } from '../lib/prisma.js';
import { validate } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { semesterCalc } from '../services/calc.service.js';

export const semestersRouter = Router();
semestersRouter.use(requireAuth);

const updateSemesterSchema = z.object({
  term: z.number().int().min(1).max(16).optional(),
  label: z.string().trim().max(120).nullable().optional(),
  ipsTarget: z.number().min(0).max(4).nullable().optional(),
});
const createCourseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  credits: z.number().int().min(1).max(30),
  grade: z.enum(GRADE_LETTERS).nullable().optional().default(null),
});

async function findOwnedSemester(id: string, userId: string) {
  return prisma.semester.findFirst({ where: { id, plan: { userId } } });
}

semestersRouter.patch(
  '/:semesterId',
  asyncHandler(async (req, res) => {
    const existing = await findOwnedSemester(req.params.semesterId, req.userId!);
    if (!existing) throw notFound('Semester not found');
    const data = validate(updateSemesterSchema, req.body);

    if (data.term !== undefined && data.term !== existing.term) {
      const conflict = await prisma.semester.findUnique({
        where: { planId_term: { planId: existing.planId, term: data.term } },
      });
      if (conflict) throw new HttpError(409, 'Term already exists in this plan');
    }

    const semester = await prisma.semester.update({
      where: { id: existing.id },
      data: {
        ...(data.term !== undefined ? { term: data.term } : {}),
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.ipsTarget !== undefined ? { ipsTarget: data.ipsTarget } : {}),
      },
    });
    res.json({ semester });
  }),
);

semestersRouter.delete(
  '/:semesterId',
  asyncHandler(async (req, res) => {
    const existing = await findOwnedSemester(req.params.semesterId, req.userId!);
    if (!existing) throw notFound('Semester not found');
    await prisma.semester.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);

semestersRouter.get(
  '/:semesterId/courses',
  asyncHandler(async (req, res) => {
    const semester = await findOwnedSemester(req.params.semesterId, req.userId!);
    if (!semester) throw notFound('Semester not found');
    const courses = await prisma.course.findMany({
      where: { semesterId: semester.id },
      orderBy: { name: 'asc' },
    });
    res.json({ courses });
  }),
);

semestersRouter.post(
  '/:semesterId/courses',
  asyncHandler(async (req, res) => {
    const semester = await findOwnedSemester(req.params.semesterId, req.userId!);
    if (!semester) throw notFound('Semester not found');
    const data = validate(createCourseSchema, req.body);
    const course = await prisma.course.create({
      data: {
        semesterId: semester.id,
        name: data.name,
        credits: data.credits,
        grade: data.grade,
      },
    });
    res.status(201).json({ course });
  }),
);

semestersRouter.get(
  '/:semesterId/calc',
  asyncHandler(async (req, res) => {
    res.json(await semesterCalc(req.params.semesterId, req.userId!));
  }),
);