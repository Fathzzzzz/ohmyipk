import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { HttpError, notFound } from '../lib/httpError.js';
import { prisma } from '../lib/prisma.js';
import { validate } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { planCalc } from '../services/calc.service.js';

export const plansRouter = Router();
plansRouter.use(requireAuth);

const createPlanSchema = z.object({
  name: z.string().trim().min(1).max(120),
  totalCreditsTarget: z.number().int().min(1).max(400).optional(),
  ipkTarget: z.number().min(0).max(4).optional(),
});
const updatePlanSchema = createPlanSchema.partial();
const createSemesterSchema = z.object({
  term: z.number().int().min(1).max(16),
  label: z.string().trim().max(120).optional(),
  ipsTarget: z.number().min(0).max(4).optional(),
});

plansRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const plans = await prisma.studyPlan.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { semesters: true } } },
    });
    res.json({ plans });
  }),
);

plansRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = validate(createPlanSchema, req.body);
    const plan = await prisma.studyPlan.create({
      data: {
        userId: req.userId!,
        name: data.name,
        ...(data.totalCreditsTarget !== undefined ? { totalCreditsTarget: data.totalCreditsTarget } : {}),
        ...(data.ipkTarget !== undefined ? { ipkTarget: data.ipkTarget } : {}),
      },
    });
    res.status(201).json({ plan });
  }),
);

plansRouter.get(
  '/:planId',
  asyncHandler(async (req, res) => {
    const plan = await prisma.studyPlan.findFirst({
      where: { id: req.params.planId, userId: req.userId! },
    });
    if (!plan) throw notFound('Plan not found');
    res.json({ plan });
  }),
);

plansRouter.patch(
  '/:planId',
  asyncHandler(async (req, res) => {
    const data = validate(updatePlanSchema, req.body);
    const existing = await prisma.studyPlan.findFirst({
      where: { id: req.params.planId, userId: req.userId! },
    });
    if (!existing) throw notFound('Plan not found');
    const plan = await prisma.studyPlan.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.totalCreditsTarget !== undefined ? { totalCreditsTarget: data.totalCreditsTarget } : {}),
        ...(data.ipkTarget !== undefined ? { ipkTarget: data.ipkTarget } : {}),
      },
    });
    res.json({ plan });
  }),
);

plansRouter.delete(
  '/:planId',
  asyncHandler(async (req, res) => {
    const existing = await prisma.studyPlan.findFirst({
      where: { id: req.params.planId, userId: req.userId! },
    });
    if (!existing) throw notFound('Plan not found');
    await prisma.studyPlan.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);

plansRouter.get(
  '/:planId/semesters',
  asyncHandler(async (req, res) => {
    const plan = await prisma.studyPlan.findFirst({
      where: { id: req.params.planId, userId: req.userId! },
    });
    if (!plan) throw notFound('Plan not found');
    const semesters = await prisma.semester.findMany({
      where: { planId: plan.id },
      orderBy: { term: 'asc' },
      include: { courses: { orderBy: { name: 'asc' } } },
    });
    res.json({ semesters });
  }),
);

plansRouter.post(
  '/:planId/semesters',
  asyncHandler(async (req, res) => {
    const plan = await prisma.studyPlan.findFirst({
      where: { id: req.params.planId, userId: req.userId! },
    });
    if (!plan) throw notFound('Plan not found');
    const data = validate(createSemesterSchema, req.body);
    const conflict = await prisma.semester.findUnique({
      where: { planId_term: { planId: plan.id, term: data.term } },
    });
    if (conflict) throw new HttpError(409, 'Term already exists in this plan');
    const semester = await prisma.semester.create({
      data: {
        planId: plan.id,
        term: data.term,
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.ipsTarget !== undefined ? { ipsTarget: data.ipsTarget } : {}),
      },
    });
    res.status(201).json({ semester });
  }),
);

plansRouter.get(
  '/:planId/calc',
  asyncHandler(async (req, res) => {
    res.json(await planCalc(req.params.planId, req.userId!));
  }),
);