import {
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
} from '@ohmyipk/calc';
import type { Course, SemesterWithCourses } from '../api/types';

export interface SemesterView extends SemesterWithCourses {
  stats: SemesterStats;
  prediction: Prediction | null;
  insight: CombinationInsight | null;
}

export interface PlanView {
  cumulative: Prediction;
  cumulativeInsight: CombinationInsight;
  semesters: SemesterView[];
}

function toInput(c: Course) {
  return { id: c.id, name: c.name, credits: c.credits, grade: (c.grade ?? null) as GradeLetter | null };
}

function insightFor(prediction: Prediction, open: Course[], scale: GradeScale): CombinationInsight {
  const openCredits = open.reduce((a, c) => a + c.credits, 0);
  return enumerateCombinations({
    remainingCourses: open.map((c) => ({ id: c.id, name: c.name, credits: c.credits })),
    neededPoints: openSetNeed(prediction.lossBudget, openCredits),
    scale,
  });
}

/**
 * Instant, pure recompute for the UI — the same shared engine the backend uses
 * for authoritative validation, so the numbers can never drift apart.
 */
export function computePlanView(
  plan: { totalCreditsTarget: number; ipkTarget: number; semesters: SemesterWithCourses[] },
  scale: GradeScale,
): PlanView {
  const semesterInputs = plan.semesters.map((s) => ({
    id: s.id,
    term: s.term,
    label: s.label ?? undefined,
    courses: s.courses.map(toInput),
  }));

  const cumulative = computeCumulative(
    semesterInputs,
    { totalCreditsTarget: plan.totalCreditsTarget, ipkTarget: plan.ipkTarget },
    scale,
  );

  const openSet = semesterInputs.flatMap((s) => s.courses).filter((c) => c.grade === null);
  const cumulativeInsight = insightFor(
    cumulative,
    openSet.map((c) => ({ id: c.id, name: c.name, credits: c.credits, grade: null })),
    scale,
  );

  const semesters: SemesterView[] = plan.semesters.map((s) => {
    const coursesInput = s.courses.map(toInput);
    const stats = semesterStats(coursesInput, scale);
    const prediction = s.ipsTarget === null ? null : computeSemester(coursesInput, s.ipsTarget, scale);
    const open = s.courses.filter((c) => c.grade === null);
    const insight = prediction === null ? null : insightFor(prediction, open, scale);
    return { ...s, stats, prediction, insight };
  });

  return { cumulative, cumulativeInsight, semesters };
}