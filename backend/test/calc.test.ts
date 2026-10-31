import { describe, expect, it } from 'vitest';
import {
  AMAN_MAX_WEIGHT,
  DEFAULT_GRADE_SCALE,
  MAX_WEIGHT,
  computeCumulative,
  computeSemester,
  enumerateCombinations,
  formatWeight,
  gpaToWeight,
  gradeWeight,
  minLetterMeeting,
  predict,
  scaleLetters,
  semesterStats,
  weightToGpa,
  whatIfRequired,
} from '../src/calc/index.js';
import type { GradeLetter, SemesterInput } from '../src/calc/index.js';

const S = DEFAULT_GRADE_SCALE;

describe('grade scale', () => {
  it('maps letters to integer weights (x100)', () => {
    expect(gradeWeight('A', S)).toBe(400);
    expect(gradeWeight('B+', S)).toBe(350);
    expect(gradeWeight('B', S)).toBe(300);
    expect(gradeWeight('E', S)).toBe(0);
  });

  it('orders letters descending', () => {
    expect(scaleLetters(S)[0]).toBe('A');
    expect(scaleLetters(S).at(-1)).toBe('E');
  });

  it('never rounds the required average down to a letter below it', () => {
    // 3.52 must say A- (3.75), NOT B+ (3.50)
    expect(minLetterMeeting(352, S)).toBe('A-');
    expect(minLetterMeeting(350, S)).toBe('B+');
    expect(minLetterMeeting(351, S)).toBe('A-');
    expect(minLetterMeeting(401, S)).toBeNull();
  });
});

describe('semester stats', () => {
  it('splits graded vs open credits', () => {
    const stats = semesterStats(
      [
        { name: 'A', credits: 3, grade: 'A' },
        { name: 'B', credits: 3, grade: 'B+' },
        { name: 'C', credits: 4, grade: null },
      ],
      S,
    );
    expect(stats.totalCredits).toBe(10);
    expect(stats.gradedCredits).toBe(6);
    expect(stats.ungradedCredits).toBe(4);
    expect(stats.earnedPoints).toBe(3 * 400 + 3 * 350);
    expect(stats.ips).toBeCloseTo(3.75, 5);
  });
});

describe('computeSemester (IPS target)', () => {
  // One graded B+ (3 SKS) + three open courses (3 SKS each), target 3.60.
  const courses = [
    { name: 'Graded', credits: 3, grade: 'B+' as GradeLetter },
    { name: 'Open1', credits: 3, grade: null },
    { name: 'Open2', credits: 3, grade: null },
    { name: 'Open3', credits: 3, grade: null },
  ];

  it('computes required average, status, honest letter and loss budget', () => {
    const r = computeSemester(courses, 3.6, S);
    expect(r.totalCredits).toBe(12);
    expect(r.gradedCredits).toBe(3);
    expect(r.remainingCredits).toBe(9);
    // needed = 360*12 - 1050 = 3270; /9 -> ceil 364 = 3.64
    expect(r.requiredWeight).toBe(364);
    expect(r.requiredAverage).toBeCloseTo(3.64, 5);
    expect(r.minRequiredLetter).toBe('A-');
    expect(r.status).toBe('KETAT');
    // maximum = 1050 + 400*9 = 4650; target = 4320 -> 330 point budget
    expect(r.lossBudget).toBe(330);
    expect(r.current).toBeCloseTo(3.5, 5);
    expect(r.maxPossible).toBeCloseTo(3.875, 5);
  });

  it('proves the B+ rounding trap via combinations', () => {
    // 9 open credits need 3270 points -> required avg 3.633;
    // B+ (3.50 -> 3150) fails, A- (3.75 -> 3375) passes.
    const insight = enumerateCombinations({
      remainingCourses: [{ credits: 9 }],
      neededPoints: 3270,
      scale: S,
    });
    expect(insight.allPass).toBe(false);
    expect(insight.allFail).toBe(false);

    const bplus = insight.failing.find((c) => c.grades[0] === 'B+');
    const amin = insight.passing.find((c) => c.grades[0] === 'A-');
    expect(bplus?.passes).toBe(false);
    expect(bplus?.points).toBe(3150);
    expect(amin?.passes).toBe(true);
    expect(amin?.points).toBe(3375);
  });
});

describe('computeCumulative (IPK target)', () => {
  it('computes required average for a mid-plan student', () => {
    // 40 graded credits at 3.25 = 13000 points; target 3.50 over 144.
    const semesters: SemesterInput[] = [
      {
        term: 1,
        courses: [
          { name: 'c1', credits: 20, grade: 'B+' },
          { name: 'c2', credits: 20, grade: 'B' },
        ],
      },
    ];
    const r = computeCumulative(
      semesters,
      { totalCreditsTarget: 144, ipkTarget: 3.5 },
      S,
    );
    expect(r.gradedCredits).toBe(40);
    expect(r.remainingCredits).toBe(104);
    expect(r.current).toBeCloseTo(3.25, 5);
    // needed = 350*144 - 13000 = 37400; /104 -> ceil 360 = 3.60
    expect(r.requiredWeight).toBe(360);
    expect(r.status).toBe('KETAT');
    // max = 13000 + 400*104 = 54600; target 50400 -> 4200
    expect(r.lossBudget).toBe(4200);
    expect(r.maxPossible).toBeCloseTo(54600 / 144 / 100, 5);
  });

  it('flags GAGAL when needed average exceeds 4.00', () => {
    // 100 graded credits all B, target 4.00 over 144.
    const semesters: SemesterInput[] = [
      { term: 1, courses: [{ name: 'c', credits: 100, grade: 'B' }] },
    ];
    const r = computeCumulative(
      semesters,
      { totalCreditsTarget: 144, ipkTarget: 4.0 },
      S,
    );
    // needed = 400*144 - 30000 = 27600; /44 -> ceil 628 > 400
    expect(r.requiredWeight).toBe(628);
    expect(r.status).toBe('GAGAL');
    expect(r.minRequiredLetter).toBeNull();
    expect(r.lossBudget).toBeLessThan(0);
  });

  it('flags AMAN when a B+ average suffices', () => {
    // 60 graded credits all A, target 2.50 over 144.
    const semesters: SemesterInput[] = [
      { term: 1, courses: [{ name: 'c', credits: 60, grade: 'A' }] },
    ];
    const r = computeCumulative(
      semesters,
      { totalCreditsTarget: 144, ipkTarget: 2.5 },
      S,
    );
    expect(r.requiredWeight).toBe(143);
    expect(r.status).toBe('AMAN');
  });
});

describe('predict edge cases', () => {
  it('AMAN when already above target (needed <= 0)', () => {
    const r = predict(
      { gradedCredits: 100, earnedPoints: 40000, totalCredits: 144, targetWeight: 250 },
      S,
    );
    expect(r.status).toBe('AMAN');
    expect(r.requiredWeight).toBeNull();
    expect(r.lossBudget).toBe(21600);
  });

  it('GAGAL when no credits remain but target unmet', () => {
    const r = predict(
      { gradedCredits: 144, earnedPoints: 40000, totalCredits: 144, targetWeight: 350 },
      S,
    );
    expect(r.status).toBe('GAGAL');
    expect(r.remainingCredits).toBe(0);
  });

  it('AMAN when needed average is exactly at the safe boundary', () => {
    // requiredWeight exactly 350 -> AMAN
    const r = predict(
      { gradedCredits: 0, earnedPoints: 0, totalCredits: 10, targetWeight: 350 },
      S,
    );
    expect(r.requiredWeight).toBe(350);
    expect(r.status).toBe('AMAN');
  });

  it('KETAT just above the safe boundary', () => {
    const r = predict(
      { gradedCredits: 0, earnedPoints: 0, totalCredits: 10, targetWeight: 351 },
      S,
    );
    expect(r.requiredWeight).toBe(351);
    expect(r.status).toBe('KETAT');
  });
});

describe('what-if', () => {
  it('fixing one open course to C+ tightens (or breaks) the rest', () => {
    // Same semester as above: 12 total, 3 graded (B+), target 3.60.
    const base = { gradedCredits: 3, earnedPoints: 1050, totalCredits: 64, targetWeight: gpaToWeight(3.6) };
    const before = predict(base, S);
    expect(before.status).toBe('KETAT');

    const after = whatIfRequired(base, S, { credits: 3, letter: 'C+' });
    expect(after.remainingAfterFix).toBe(58);
    // fixing a C+ raises the required average on the rest
    expect(after.requiredWeight).toBeGreaterThan((before.requiredWeight ?? 0));

    // A single C+ on ONE open course of the tiny semester still leaves room:
    // remaining 6 credits must carry 3270 - 750 = 2520 -> 420 avg -> GAGAL.
    const tinyBase = { gradedCredits: 3, earnedPoints: 1050, totalCredits: 12, targetWeight: gpaToWeight(3.6) };
    const tiny = whatIfRequired(tinyBase, S, { credits: 3, letter: 'C+' });
    expect(tiny.remainingAfterFix).toBe(6);
    expect(tiny.status).toBe('GAGAL');
  });
});

describe('enumerateCombinations degenerate cases', () => {
  it('allPass when no points are needed', () => {
    const r = enumerateCombinations({
      remainingCourses: [{ credits: 3 }],
      neededPoints: 0,
      scale: S,
    });
    expect(r.allPass).toBe(true);
    expect(r.mode).toBe('none');
  });

  it('allFail when even all-A cannot reach', () => {
    const r = enumerateCombinations({
      remainingCourses: [{ credits: 3 }],
      neededPoints: 1600, // > 400*3
      scale: S,
    });
    expect(r.allFail).toBe(true);
  });

  it('greedy fallback for large open sets stays consistent', () => {
    const courses = Array.from({ length: 10 }, () => ({ credits: 3 }));
    const r = enumerateCombinations({
      remainingCourses: courses,
      neededPoints: 30 * 350, // B+ average, achievable
      scale: S,
    });
    expect(r.mode).toBe('greedy');
    expect(r.truncated).toBe(true);
    expect(r.passing[0]!.passes).toBe(true);
    expect(r.passing[0]!.points).toBeGreaterThanOrEqual(30 * 350);
  });
});

describe('format helpers', () => {
  it('round-trips GPA <-> weight and formats strings', () => {
    expect(gpaToWeight(3.6)).toBe(360);
    expect(gpaToWeight(3.5)).toBe(350);
    expect(weightToGpa(364)).toBeCloseTo(3.64, 5);
    expect(formatWeight(350)).toBe('3.50');
    expect(formatWeight(364)).toBe('3.64');
  });

  it('exposes constants used by status thresholds', () => {
    expect(AMAN_MAX_WEIGHT).toBe(350);
    expect(MAX_WEIGHT).toBe(400);
  });
});