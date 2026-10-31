import type { GradeLetter, GradeScale } from './types.js';

/**
 * All grade weights are integers. A weight equals the real GPA value times
 * WEIGHT_BASE. WEIGHT_BASE = 100 keeps quarter-step campus scales integral
 * (A- = 3.75 -> 375), so required-average comparisons at a target boundary are
 * exact integer arithmetic and can never drift due to floating point.
 */
export const WEIGHT_BASE = 100;

/** Highest letter weight (A = 4.00). */
export const MAX_WEIGHT = 400;

/** Lowest letter weight (E = 0.00). */
export const MIN_WEIGHT = 0;

/**
 * AMAN/KETAT boundary. A remaining-set average at or below this is "safe":
 * a plain B+ average (3.50) still meets it. Above it the target is tight and
 * needs A-/A territory.
 */
export const AMAN_MAX_WEIGHT = 350; // B+ = 3.50

/** Default 4.0 scale; weights always integer (x100). */
export const DEFAULT_GRADE_SCALE: GradeScale = Object.freeze({
  A: 400,
  'A-': 375,
  'B+': 350,
  B: 300,
  'B-': 275,
  'C+': 250,
  C: 200,
  'C-': 175,
  D: 100,
  E: 0,
});

/** Integer weight for a letter; throws on an unknown letter. */
export function gradeWeight(letter: GradeLetter, scale: GradeScale): number {
  const w = scale[letter];
  if (typeof w !== 'number') {
    throw new Error(`Unknown grade letter "${letter}" in scale`);
  }
  return w;
}

/** Letters present in a scale, sorted descending by weight (A first). */
export function scaleLetters(scale: GradeScale): GradeLetter[] {
  return (Object.keys(scale) as GradeLetter[]).sort(
    (a, b) => gradeWeight(b, scale) - gradeWeight(a, scale),
  );
}

/**
 * Lowest single letter whose weight already meets `requiredWeight`.
 * This is the honest "minimum grade I need", deliberately NOT rounding 3.52
 * down to B+ (3.50). Returns null when requiredWeight exceeds MAX_WEIGHT.
 */
export function minLetterMeeting(
  requiredWeight: number,
  scale: GradeScale,
): GradeLetter | null {
  if (requiredWeight > MAX_WEIGHT) return null;
  let best: GradeLetter | null = null;
  for (const letter of scaleLetters(scale)) {
    if (gradeWeight(letter, scale) >= requiredWeight) best = letter;
  }
  return best;
}