import { WEIGHT_BASE } from './gradeScale.js';

/** Human GPA (float) -> integer weight (x100). */
export function gpaToWeight(gpa: number): number {
  return Math.round(gpa * WEIGHT_BASE);
}

/** Integer weight (x100) -> human GPA (float). */
export function weightToGpa(weight: number): number {
  return weight / WEIGHT_BASE;
}

/** Format a GPA float (e.g. 3.5 -> "3.50"). */
export function formatGpa(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return '—';
  return value.toFixed(digits);
}

/** Format an integer weight (x100) as a GPA string (e.g. 352 -> "3.52"). */
export function formatWeight(
  weight: number | null | undefined,
  digits = 2,
): string {
  if (weight === null || weight === undefined) return '—';
  return weightToGpa(weight).toFixed(digits);
}