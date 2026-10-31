import {
  DEFAULT_GRADE_SCALE,
  computeCumulative,
  computeSemester,
  enumerateCombinations,
  openSetNeed,
  semesterStats,
  type CombinationInsight,
  type GradeLetter,
  type GradeScale,
  type Prediction,
  type SemesterStats,
} from '../calc/index.js';
import { HttpError } from '../lib/httpError.js';
import { prisma } from '../lib/prisma.js';

export interface SemesterCalcBlock {
  id: string;
  term: number;
  label: string | null;
  ipsTarget: number | null;
  stats: SemesterStats;
  prediction: Prediction | null;
  insight: CombinationInsight | null;
}

async function scaleRecord(): Promise<GradeScale> {
  const rows = await prisma.gradeScale.findMany();
  if (rows.length === 0) return { ...DEFAULT_GRADE_SCALE };
  const s: Record<string, number> = {};
  for (const r of rows) s[r.letter] = r.weight;
  return s as GradeScale;
}

type CourseLike = { id: string; name: string; credits: number; grade: string | null };

function toCourseInput(c: CourseLike) {
  return { id: c.id, name: c.name, credits: c.credits, grade: c.grade as GradeLetter | null };
}

/** Authoritative full-plan recompute (cumulative + per-semester + insights). */
export async function planCalc(planId: string, userId: string) {
  const plan = await prisma.studyPlan.findFirst({
    where: { id: planId, userId },
    include: {
      semesters: {
        orderBy: { term: 'asc' },
        include: { courses: { orderBy: { name: 'asc' } } },
      },
    },
  });
  if (!plan) throw new HttpError(404, 'Plan not found');
  const scale = await scaleRecord();

  const semesterInputs = plan.semesters.map((s) => ({
    id: s.id,
    term: s.term,
    label: s.label ?? undefined,
    courses: s.courses.map((c) => toCourseInput(c)),
  }));

  const cumulative = computeCumulative(
    semesterInputs,
    { totalCreditsTarget: plan.totalCreditsTarget, ipkTarget: plan.ipkTarget },
    scale,
  );

  const openSet = semesterInputs
    .flatMap((s) => s.courses)
    .filter((c) => c.grade === null);
  const openCredits = openSet.reduce((a, c) => a + c.credits, 0);
  const cumulativeInsight = enumerateCombinations({
    remainingCourses: openSet.map((c) => ({ id: c.id, name: c.name, credits: c.credits })),
    neededPoints: openSetNeed(cumulative.lossBudget, openCredits),
    scale,
  });

  const semesters: SemesterCalcBlock[] = plan.semesters.map((s) => {
    const coursesInput = s.courses.map((c) => toCourseInput(c));
    const stats = semesterStats(coursesInput, scale);
    const prediction =
      s.ipsTarget === null ? null : computeSemester(coursesInput, s.ipsTarget, scale);
    const open = coursesInput.filter((c) => c.grade === null);
    const openCreditsSem = open.reduce((a, c) => a + c.credits, 0);
    const insight =
      prediction === null
        ? null
        : enumerateCombinations({
            remainingCourses: open.map((c) => ({ id: c.id, name: c.name, credits: c.credits })),
            neededPoints: openSetNeed(prediction.lossBudget, openCreditsSem),
            scale,
          });
    return {
      id: s.id,
      term: s.term,
      label: s.label,
      ipsTarget: s.ipsTarget,
      stats,
      prediction,
      insight,
    };
  });

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      totalCreditsTarget: plan.totalCreditsTarget,
      ipkTarget: plan.ipkTarget,
    },
    cumulative,
    cumulativeInsight,
    semesters,
  };
}

/** Authoritative single-semester recompute. */
export async function semesterCalc(semesterId: string, userId: string) {
  const semester = await prisma.semester.findFirst({
    where: { id: semesterId, plan: { userId } },
    include: { courses: { orderBy: { name: 'asc' } } },
  });
  if (!semester) throw new HttpError(404, 'Semester not found');
  const scale = await scaleRecord();
  const coursesInput = semester.courses.map((c) => toCourseInput(c));
  const stats = semesterStats(coursesInput, scale);
  const prediction =
    semester.ipsTarget === null ? null : computeSemester(coursesInput, semester.ipsTarget, scale);
  const open = coursesInput.filter((c) => c.grade === null);
  const openCredits = open.reduce((a, c) => a + c.credits, 0);
  const insight =
    prediction === null
      ? null
      : enumerateCombinations({
          remainingCourses: open.map((c) => ({ id: c.id, name: c.name, credits: c.credits })),
          neededPoints: openSetNeed(prediction.lossBudget, openCredits),
          scale,
        });
  return {
    semester: {
      id: semester.id,
      term: semester.term,
      label: semester.label,
      ipsTarget: semester.ipsTarget,
      planId: semester.planId,
    },
    stats,
    prediction,
    insight,
  };
}