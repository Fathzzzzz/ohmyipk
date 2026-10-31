import { useState } from 'react';
import {
  computeSemester,
  formatWeight,
  gpaToWeight,
  whatIfRequired,
  type GradeLetter,
  type GradeScale,
} from '@ohmyipk/calc';
import type { Course } from '../api/types';
import { StatusBadge } from './StatusBadge';

export function WhatIfPanel({
  courses,
  ipsTarget,
  scale,
  letters,
}: {
  courses: Course[];
  ipsTarget: number;
  scale: GradeScale;
  letters: GradeLetter[];
}) {
  const open = courses.filter((c) => c.grade === null);
  const [courseId, setCourseId] = useState<string>('');
  const [letter, setLetter] = useState<GradeLetter>('A');

  if (open.length === 0) return null;

  const sel = open.find((c) => c.id === courseId) ?? open[0]!;
  const inputs = courses.map((c) => ({
    id: c.id,
    credits: c.credits,
    grade: (c.grade ?? null) as GradeLetter | null,
  }));
  const pred = computeSemester(inputs, ipsTarget, scale);
  const result = whatIfRequired(
    {
      gradedCredits: pred.gradedCredits,
      earnedPoints: pred.earnedPoints,
      totalCredits: pred.totalCredits,
      targetWeight: gpaToWeight(ipsTarget),
    },
    scale,
    { credits: sel.credits, letter },
  );

  return (
    <div className="card mt">
      <h4>Simulasi what-if</h4>
      <div className="row">
        <label>
          Mata kuliah
          <select value={sel.id} onChange={(e) => setCourseId(e.target.value)}>
            {open.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nilai hipotetis
          <select value={letter} onChange={(e) => setLetter(e.target.value as GradeLetter)}>
            {letters.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="small mt">
        Jika <strong>{sel.name}</strong> = <strong>{letter}</strong>, maka sisa{' '}
        {result.remainingAfterFix} SKS wajib rata-rata{' '}
        <strong>{formatWeight(result.requiredWeight)}</strong> (nilai minimal{' '}
        {result.minRequiredLetter ?? '—'}) <StatusBadge status={result.status} />
      </p>
    </div>
  );
}