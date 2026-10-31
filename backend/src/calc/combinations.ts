import { MAX_WEIGHT, gradeWeight, scaleLetters } from './gradeScale.js';
import { weightToGpa } from './format.js';
import type { GradeLetter, GradeScale } from './types.js';

/** A course still waiting on a grade (part of the "remaining room"). */
export interface RemainingCourse {
  id?: string;
  name?: string;
  credits: number;
}

/** One concrete grade assignment across the remaining courses. */
export interface GradeCombo {
  /** Grades aligned with the input course order. */
  grades: GradeLetter[];
  /** sum(weight x credits) for the combination (integer). */
  points: number;
  totalCredits: number;
  /** Points lost vs all-A (integer). */
  loss: number;
  /** What this combination averages as a GPA float (display). */
  achieved: number;
  /** Whether this combination already meets the target need. */
  passes: boolean;
}

export interface CombinationInsight {
  remainingCredits: number;
  /** Required average on the remaining set as a GPA float (unrounded). */
  needAverage: number | null;
  /** Representative combos that pass (tightest first). */
  passing: GradeCombo[];
  /** Representative combos that fail (closest to passing first). */
  failing: GradeCombo[];
  /** Even the lowest possible grades still pass. */
  allPass: boolean;
  /** Even all-A fails the target. */
  allFail: boolean;
  /** true when examples are heuristics, not an exhaustive enumeration. */
  truncated: boolean;
  mode: 'exhaustive' | 'greedy' | 'none';
}

export interface EnumerateInput {
  /** Courses whose grades are still open. */
  remainingCourses: RemainingCourse[];
  /** Minimum points (sum of weight x credits) this set must supply. */
  neededPoints: number;
  scale: GradeScale;
  /** Max examples kept per bucket (default 8). */
  maxExamples?: number;
}

/** Exhaustive when the open set is small (5^n stays fast); greedy/DP-equivalent otherwise. */
const EXHAUSTIVE_COURSE_LIMIT = 6;
const EXHAUSTIVE_COMBO_LIMIT = 1_500_000;

function bestPass(a: GradeCombo, b: GradeCombo): boolean {
  return a.loss > b.loss; // tighter to the budget still passing
}
function bestFail(a: GradeCombo, b: GradeCombo): boolean {
  return a.loss < b.loss; // closest to passing without passing
}

function pushCapped(
  arr: GradeCombo[],
  combo: GradeCombo,
  cap: number,
  better: (a: GradeCombo, b: GradeCombo) => boolean,
): void {
  if (arr.length < cap) {
    arr.push(combo);
    return;
  }
  let worst = 0;
  for (let i = 1; i < arr.length; i++) {
    if (!better(arr[i]!, arr[worst]!)) worst = i;
  }
  if (better(combo, arr[worst]!)) arr[worst] = combo;
}

/** Exhaustive odometer over letters^courses. */
function bruteExamples(
  creds: number[],
  letters: GradeLetter[],
  weights: number[],
  neededPoints: number,
  totalCredits: number,
  maxPoints: number,
  cap: number,
): { passing: GradeCombo[]; failing: GradeCombo[] } {
  const n = creds.length;
  const idx = new Array<number>(n).fill(0);
  const passing: GradeCombo[] = [];
  const failing: GradeCombo[] = [];

  let done = false;
  while (!done) {
    let points = 0;
    const grades = new Array<GradeLetter>(n);
    for (let i = 0; i < n; i++) {
      const li = idx[i]!;
      grades[i] = letters[li]!;
      points += weights[li]! * creds[i]!;
    }
    const passes = points >= neededPoints;
    const combo: GradeCombo = {
      grades,
      points,
      totalCredits,
      loss: maxPoints - points,
      achieved: weightToGpa(points / totalCredits),
      passes,
    };
    if (passes) pushCapped(passing, combo, cap, bestPass);
    else pushCapped(failing, combo, cap, bestFail);

    let j = 0;
    while (j < n) {
      idx[j] = idx[j]! + 1;
      if (idx[j]! < letters.length) break;
      idx[j] = 0;
      j++;
    }
    if (j === n) done = true;
  }

  passing.sort((a, b) => b.loss - a.loss);
  failing.sort((a, b) => a.loss - b.loss);
  return { passing, failing };
}

/** Representative (heuristic) examples when the open set is too large to enumerate. */
function greedyExamples(
  creds: number[],
  letters: GradeLetter[],
  weights: number[],
  neededPoints: number,
  totalCredits: number,
  maxPoints: number,
): { passing: GradeCombo[]; failing: GradeCombo[] } {
  const n = creds.length;
  const grades = new Array<GradeLetter>(n).fill(letters[0]!);
  let points = maxPoints;

  // Tighten: repeatedly take the single-step downgrade that keeps >= needed.
  for (;;) {
    let bestCourse = -1;
    let bestLetter = -1;
    let bestPoints = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      const cur = letters.indexOf(grades[i]!);
      for (let li = cur + 1; li < letters.length; li++) {
        const np = points - (weights[cur]! - weights[li]!) * creds[i]!;
        if (np >= neededPoints && np > bestPoints) {
          bestPoints = np;
          bestCourse = i;
          bestLetter = li;
        }
      }
    }
    if (bestCourse === -1) break;
    grades[bestCourse] = letters[bestLetter]!;
    points = bestPoints;
  }

  const tightPass: GradeCombo = {
    grades: [...grades],
    points,
    totalCredits,
    loss: maxPoints - points,
    achieved: weightToGpa(points / totalCredits),
    passes: true,
  };

  // Closest miss: one more step down on any course that still has room.
  let nearFail: GradeCombo | null = null;
  for (let i = 0; i < n; i++) {
    const cur = letters.indexOf(grades[i]!);
    for (let li = cur + 1; li < letters.length; li++) {
      const np = points - (weights[cur]! - weights[li]!) * creds[i]!;
      if (np < neededPoints) {
        const fg = [...grades];
        fg[i] = letters[li]!;
        const c: GradeCombo = {
          grades: fg,
          points: np,
          totalCredits,
          loss: maxPoints - np,
          achieved: weightToGpa(np / totalCredits),
          passes: false,
        };
        if (nearFail === null || c.loss < nearFail.loss) nearFail = c;
        break;
      }
    }
  }

  return { passing: [tightPass], failing: nearFail ? [nearFail] : [] };
}

/**
 * Turn a required average into example grade combinations.
 * Small open sets are enumerated exactly; large ones fall back to a greedy
 * representative (the intended DP/worker fallback for scale).
 */
export function enumerateCombinations(
  input: EnumerateInput,
): CombinationInsight {
  const { remainingCourses, neededPoints, scale, maxExamples = 8 } = input;
  const creds = remainingCourses.map((c) => c.credits);
  const totalCredits = creds.reduce((a, b) => a + b, 0);
  const maxPoints = MAX_WEIGHT * totalCredits;
  const needAverage =
    totalCredits > 0 ? weightToGpa(neededPoints / totalCredits) : null;

  if (totalCredits === 0) {
    return {
      remainingCredits: 0,
      needAverage: null,
      passing: [],
      failing: [],
      allPass: true,
      allFail: false,
      truncated: false,
      mode: 'none',
    };
  }

  const allPass = neededPoints <= 0;
  const allFail = neededPoints > maxPoints;

  if (allPass) {
    return {
      remainingCredits: totalCredits,
      needAverage,
      passing: [],
      failing: [],
      allPass: true,
      allFail: false,
      truncated: false,
      mode: 'none',
    };
  }

  const letters = scaleLetters(scale);
  const weights = letters.map((l) => gradeWeight(l, scale));

  if (allFail) {
    const grades = new Array<GradeLetter>(creds.length).fill(letters[0]!);
    const best: GradeCombo = {
      grades,
      points: maxPoints,
      totalCredits,
      loss: 0,
      achieved: weightToGpa(maxPoints / totalCredits),
      passes: false,
    };
    return {
      remainingCredits: totalCredits,
      needAverage,
      passing: [],
      failing: [best],
      allPass: false,
      allFail: true,
      truncated: false,
      mode: 'none',
    };
  }

  const exhaustive =
    creds.length <= EXHAUSTIVE_COURSE_LIMIT &&
    Math.pow(letters.length, creds.length) <= EXHAUSTIVE_COMBO_LIMIT;

  const { passing, failing } = exhaustive
    ? bruteExamples(
        creds,
        letters,
        weights,
        neededPoints,
        totalCredits,
        maxPoints,
        maxExamples,
      )
    : greedyExamples(creds, letters, weights, neededPoints, totalCredits, maxPoints);

  return {
    remainingCredits: totalCredits,
    needAverage,
    passing,
    failing,
    allPass: false,
    allFail: false,
    truncated: !exhaustive,
    mode: exhaustive ? 'exhaustive' : 'greedy',
  };
}