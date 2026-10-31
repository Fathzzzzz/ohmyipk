import { useState, type FormEvent } from 'react';
import { formatGpa, type GradeLetter, type GradeScale } from '@ohmyipk/calc';
import type { SemesterView } from '../lib/calcPlan';
import { InsightPanel } from './InsightPanel';
import { PredictionPanel } from './PredictionPanel';
import { WhatIfPanel } from './WhatIfPanel';

interface Props {
  semester: SemesterView;
  letters: GradeLetter[];
  scale: GradeScale;
  onGradeChange: (courseId: string, grade: GradeLetter | null) => void;
  onAddCourse: (semesterId: string, name: string, credits: number) => void;
  onDeleteCourse: (courseId: string) => void;
  onUpdateIpsTarget: (semesterId: string, target: number | null) => void;
}

export function SemesterCard({
  semester,
  letters,
  scale,
  onGradeChange,
  onAddCourse,
  onDeleteCourse,
  onUpdateIpsTarget,
}: Props) {
  const [name, setName] = useState('');
  const [credits, setCredits] = useState('3');
  const title = semester.label ?? `Semester ${semester.term}`;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAddCourse(semester.id, name.trim(), Number(credits));
    setName('');
  }

  return (
    <div className="card">
      <div className="sem-head">
        <h3>{title}</h3>
        <span className="muted small">IPS: {formatGpa(semester.stats.ips)}</span>
        <label className="inline">
          Target IPS
          <input
            type="number"
            step="0.01"
            min={0}
            max={4}
            value={semester.ipsTarget ?? ''}
            placeholder="—"
            onChange={(e) =>
              onUpdateIpsTarget(semester.id, e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </label>
      </div>

      <table className="courses">
        <thead>
          <tr>
            <th>Mata Kuliah</th>
            <th>SKS</th>
            <th>Nilai</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {semester.courses.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.credits}</td>
              <td>
                <select
                  value={c.grade ?? ''}
                  onChange={(e) =>
                    onGradeChange(c.id, e.target.value === '' ? null : (e.target.value as GradeLetter))
                  }
                >
                  <option value="">— (belum keluar)</option>
                  {letters.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button className="ghost" type="button" onClick={() => onDeleteCourse(c.id)}>
                  Hapus
                </button>
              </td>
            </tr>
          ))}
          {semester.courses.length === 0 && (
            <tr>
              <td colSpan={4} className="muted small">
                Belum ada mata kuliah.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form className="row mt" onSubmit={submit}>
        <input
          placeholder="Nama mata kuliah"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1 }}
        />
        <label className="inline">
          SKS
          <input
            type="number"
            min={1}
            max={30}
            style={{ width: '5rem' }}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
          />
        </label>
        <button type="submit">Tambah</button>
      </form>

      {semester.prediction && (
        <div className="mt">
          <PredictionPanel title={`Prediksi ${title}`} prediction={semester.prediction} />
          <InsightPanel insight={semester.insight} />
          {semester.ipsTarget !== null && (
            <WhatIfPanel
              courses={semester.courses}
              ipsTarget={semester.ipsTarget}
              scale={scale}
              letters={letters}
            />
          )}
        </div>
      )}
    </div>
  );
}