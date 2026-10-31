/**
 * Shared domain types. Everything numeric that participates in comparison
 * must stay integer (see gradeScale.ts); floats appear only at the display edge.
 */

/**
 * Standard Indonesian 4.0 letter set (extend here if your campus differs).
 * Runtime array so frontend (select options) and backend (zod enum) share it.
 */
export const GRADE_LETTERS = [
  'A',
  'A-',
  'B+',
  'B',
  'B-',
  'C+',
  'C',
  'C-',
  'D',
  'E',
] as const;

export type GradeLetter = (typeof GRADE_LETTERS)[number];

/**
 * Letter -> integer weight (weight = GPA x WEIGHT_BASE).
 * Partial: a campus scale may drop letters it does not use.
 */
export type GradeScale = Readonly<Partial<Record<GradeLetter, number>>>;

/** Plain-language safety verdict for a target. */
export type Status = 'AMAN' | 'KETAT' | 'GAGAL';

/** A course as it flows into the calc engine. */
export interface CourseInput {
  id?: string;
  name?: string;
  /** SKS; must be a positive integer. */
  credits: number;
  /** null = grade not released yet (the "remaining room" predictions run on). */
  grade: GradeLetter | null;
}

/** A semester (term) containing courses. */
export interface SemesterInput {
  id?: string;
  /** 1-based term number, e.g. 1..8. */
  term: number;
  label?: string;
  courses: CourseInput[];
}