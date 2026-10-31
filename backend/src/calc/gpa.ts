import {
  AMAN_MAX_WEIGHT,
  MAX_WEIGHT,
  WEIGHT_BASE,
  gradeWeight,
  minLetterMeeting,
} from './gradeScale.js';
import { gpaToWeight } from './format.js';
import type {
  CourseInput,
  GradeLetter,
  GradeScale,
  SemesterInput,
  Status,
} from './types.js';

/** Aggregated per-semester facts (pure aggregation, no target logic). */
export interface SemesterStats {
  totalCredits: number;
  gradedCredits: number;
  ungradedCredits: number;
  earnedPoints: number;
  /** Weighted average of graded courses as a GPA float (null = nothing graded). */
  ips: number | null;
}

/** One target's full prediction. Integer fields are x100 or raw points. */
export interface Prediction {
  totalCredits: number;
  gradedCredits: number;
  remainingCredits: number;
  earnedPoints: number;
  targetPoints: number;
  /** GPA float (display only). */
  target: number;
  /** Current IPK/IPS as GPA float (display only; null = nothing graded). */
  current: number | null;
  /** Best possible if every remaining credit is graded A (float, display). */
  maxPossible: number | null;
  /** Required average per remaining credit, integer (x100). */
  requiredWeight: number | null;
  /** Required average as GPA float (display). */
  requiredAverage: number | null;
  /** Honest minimum single letter that meets the required average. */
  minRequiredLetter: GradeLetter | null;
  /** Extra points vs all-A you may still lose and hit target (integer; <0 = impossible). */
  lossBudget: number;
  status: Status;
}

/** Raw integer inputs to the target solver. */
export interface PredictInput {
  /** Credits already carrying a grade (integer >= 0). */
  gradedCredits: number;
  /** Points already earned = sum(weight x credits) over graded, integer >= 0. */
  earnedPoints: number;
  /** Denominator the target applies to (144 cumulative, or a semester's total). */
  totalCredits: number;
  /** Target as integer weight (x100). */
  targetWeight: number;
}

export interface CumulativeConfig {
  /** e.g. 144. */
  totalCreditsTarget: number;
  /** e.g. 3.50. */
  ipkTarget: number;
}

function assertCredit(credits: number, what: string): void {
  if (!Number.isInteger(credits) || credits < 0) {
    throw new Error(`${what} must be a non-negative integer, got ${credits}`);
  }
}

/** Aggregate one semester's courses into graded/ungraded buckets. */
export function semesterStats(
  courses: CourseInput[],
  scale: GradeScale,
): SemesterStats {
  let totalCredits = 0;
  let gradedCredits = 0;
  let earnedPoints = 0;
  for (const c of courses) {
    assertCredit(c.credits, `course "${c.name ?? c.id ?? '?'}" credits`);
    totalCredits += c.credits;
    if (c.grade !== null) {
      const weight = gradeWeight(c.grade, scale);
      gradedCredits += c.credits;
      earnedPoints += c.credits * weight;
    }
  }
  return {
    totalCredits,
    gradedCredits,
    ungradedCredits: totalCredits - gradedCredits,
    earnedPoints,
    ips: gradedCredits > 0 ? earnedPoints / gradedCredits / WEIGHT_BASE : null,
  };
}

/**
 * Core target solver shared by IPK (cumulative) and IPS (semester) targets.
 * Pure integer arithmetic for every comparison; floats only at the display edge.
 */
export function predict(input: PredictInput, scale: GradeScale): Prediction {
  assertCredit(input.gradedCredits, 'gradedCredits');
  assertCredit(input.earnedPoints, 'earnedPoints');
  assertCredit(input.totalCredits, 'totalCredits');
  const { gradedCredits, earnedPoints, totalCredits, targetWeight } = input;

  const remainingCredits = Math.max(0, totalCredits - gradedCredits);
  const targetPoints = targetWeight * totalCredits;
  const needed = targetPoints - earnedPoints; // integer
  const maxPoints = earnedPoints + MAX_WEIGHT * remainingCredits;
  const lossBudget = maxPoints - targetPoints; // integer (<0 => impossible)

  let requiredWeight: number | null = null;
  let status: Status;

  if (needed <= 0) {
    status = 'AMAN';
  } else if (remainingCredits <= 0) {
    status = 'GAGAL';
  } else {
    requiredWeight = Math.ceil(needed / remainingCredits);
    status =
      requiredWeight > MAX_WEIGHT
        ? 'GAGAL'
        : requiredWeight > AMAN_MAX_WEIGHT
          ? 'KETAT'
          : 'AMAN';
  }

  const currentWeight = gradedCredits > 0 ? earnedPoints / gradedCredits : null;
  const denom = gradedCredits + remainingCredits;

  return {
    totalCredits,
    gradedCredits,
    remainingCredits,
    earnedPoints,
    targetPoints,
    target: targetWeight / WEIGHT_BASE,
    current: currentWeight === null ? null : currentWeight / WEIGHT_BASE,
    maxPossible: denom > 0 ? maxPoints / denom / WEIGHT_BASE : null,
    requiredWeight,
    requiredAverage:
      requiredWeight === null ? null : requiredWeight / WEIGHT_BASE,
    minRequiredLetter:
      requiredWeight === null ? null : minLetterMeeting(requiredWeight, scale),
    lossBudget,
    status,
  };
}

/** Cumulative IPK prediction across every graded course, against the plan target. */
export function computeCumulative(
  semesters: SemesterInput[],
  config: CumulativeConfig,
  scale: GradeScale,
): Prediction {
  let gradedCredits = 0;
  let earnedPoints = 0;
  for (const s of semesters) {
    for (const c of s.courses) {
      if (c.grade !== null) {
        assertCredit(c.credits, `course "${c.name ?? c.id ?? '?'}" credits`);
        gradedCredits += c.credits;
        earnedPoints += c.credits * gradeWeight(c.grade, scale);
      }
    }
  }
  return predict(
    {
      gradedCredits,
      earnedPoints,
      totalCredits: config.totalCreditsTarget,
      targetWeight: gpaToWeight(config.ipkTarget),
    },
    scale,
  );
}

/** Per-semester IPS prediction against the semester's own IPS target. */
export function computeSemester(
  courses: CourseInput[],
  ipsTarget: number,
  scale: GradeScale,
): Prediction {
  const stats = semesterStats(courses, scale);
  return predict(
    {
      gradedCredits: stats.gradedCredits,
      earnedPoints: stats.earnedPoints,
      totalCredits: stats.totalCredits,
      targetWeight: gpaToWeight(ipsTarget),
    },
    scale,
  );
}

/** Result of pinning one remaining course to a hypothetical grade. */
export interface WhatIfResult {
  remainingAfterFix: number;
  requiredWeight: number | null;
  requiredAverage: number | null;
  minRequiredLetter: GradeLetter | null;
  status: Status;
}

/**
 * Simulate fixing one "remaining" course to a grade and re-derive what the
 * OTHER remaining courses must average. Reuses predict() so the arithmetic
 * stays identical to the real prediction.
 */
export function whatIfRequired(
  input: PredictInput,
  scale: GradeScale,
  fixed: { credits: number; letter: GradeLetter },
): WhatIfResult {
  assertCredit(fixed.credits, 'fixed course credits');
  const p = predict(
    {
      gradedCredits: input.gradedCredits + fixed.credits,
      earnedPoints:
        input.earnedPoints + fixed.credits * gradeWeight(fixed.letter, scale),
      totalCredits: input.totalCredits,
      targetWeight: input.targetWeight,
    },
    scale,
  );
  return {
    remainingAfterFix: p.remainingCredits,
    requiredWeight: p.requiredWeight,
    requiredAverage: p.requiredAverage,
    minRequiredLetter: p.minRequiredLetter,
    status: p.status,
  };
}

/**
 * Minimum points a set of yet-open courses must carry, assuming every future
 * (not-yet-entered) credit is graded A. Derived from the loss budget:
 * openNeed = openCredits*MAX_WEIGHT - lossBudget. This makes the combination
 * insight correct both for a self-contained semester and for the whole plan.
 */
export function openSetNeed(lossBudget: number, openCredits: number): number {
  return openCredits * MAX_WEIGHT - lossBudget;
}