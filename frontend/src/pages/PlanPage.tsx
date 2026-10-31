import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { GradeLetter, GradeScale } from '@ohmyipk/calc';
import type {
  Course,
  GradeScaleRow,
  Plan,
  Semester,
  SemesterWithCourses,
} from '../api/types';
import { InsightPanel } from '../components/InsightPanel';
import { PredictionPanel } from '../components/PredictionPanel';
import { SemesterCard } from '../components/SemesterCard';
import { computePlanView } from '../lib/calcPlan';
import { api } from '../lib/http';

type Fetched = {
  scale: GradeScaleRow[];
  plan: Plan;
  semesters: SemesterWithCourses[];
};

export default function PlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const [scale, setScale] = useState<GradeScale>({});
  const [letters, setLetters] = useState<GradeLetter[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [semesters, setSemesters] = useState<SemesterWithCourses[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [newTerm, setNewTerm] = useState('1');
  const [newLabel, setNewLabel] = useState('');
  const [newIps, setNewIps] = useState('');
  const [editTotal, setEditTotal] = useState('144');
  const [editIpk, setEditIpk] = useState('3.50');

  function apply({ scale: sc, plan: p, semesters: sem }: Fetched) {
    setScale(Object.fromEntries(sc.map((r) => [r.letter, r.weight])) as GradeScale);
    setLetters(sc.map((r) => r.letter as GradeLetter));
    setPlan(p);
    setSemesters(sem);
    setEditTotal(String(p.totalCreditsTarget));
    setEditIpk(String(p.ipkTarget));
  }

  async function fetchAll(): Promise<Fetched> {
    const [scale, plan, semesters] = await Promise.all([
      api<{ scale: GradeScaleRow[] }>('/api/grade-scale'),
      api<{ plan: Plan }>(`/api/plans/${planId}`),
      api<{ semesters: SemesterWithCourses[] }>(`/api/plans/${planId}/semesters`),
    ]);
    return { scale: scale.scale, plan: plan.plan, semesters: semesters.semesters };
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      apply(await fetchAll());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const view = useMemo(
    () =>
      plan
        ? computePlanView(
            { totalCreditsTarget: plan.totalCreditsTarget, ipkTarget: plan.ipkTarget, semesters },
            scale,
          )
        : null,
    [plan, semesters, scale],
  );

  function revert(e: unknown) {
    setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    fetchAll().then(apply).catch(() => {});
  }

  async function setCourseGrade(courseId: string, grade: GradeLetter | null) {
    setSemesters((prev) =>
      prev.map((s) => ({ ...s, courses: s.courses.map((c) => (c.id === courseId ? { ...c, grade } : c)) })),
    );
    try {
      await api(`/api/courses/${courseId}`, { method: 'PATCH', body: JSON.stringify({ grade }) });
    } catch (e) {
      revert(e);
    }
  }

  async function addCourse(semesterId: string, name: string, credits: number) {
    const d = await api<{ course: Course }>(`/api/semesters/${semesterId}/courses`, {
      method: 'POST',
      body: JSON.stringify({ name, credits }),
    });
    setSemesters((prev) =>
      prev.map((s) => (s.id === semesterId ? { ...s, courses: [...s.courses, d.course] } : s)),
    );
  }

  async function deleteCourse(courseId: string) {
    setSemesters((prev) =>
      prev.map((s) => ({ ...s, courses: s.courses.filter((c) => c.id !== courseId) })),
    );
    try {
      await api(`/api/courses/${courseId}`, { method: 'DELETE' });
    } catch (e) {
      revert(e);
    }
  }

  async function updateIpsTarget(semesterId: string, target: number | null) {
    setSemesters((prev) => prev.map((s) => (s.id === semesterId ? { ...s, ipsTarget: target } : s)));
    try {
      await api(`/api/semesters/${semesterId}`, { method: 'PATCH', body: JSON.stringify({ ipsTarget: target }) });
    } catch (e) {
      revert(e);
    }
  }

  async function addSemester(e: FormEvent) {
    e.preventDefault();
    const d = await api<{ semester: Semester }>(`/api/plans/${planId}/semesters`, {
      method: 'POST',
      body: JSON.stringify({
        term: Number(newTerm),
        label: newLabel || undefined,
        ipsTarget: newIps === '' ? undefined : Number(newIps),
      }),
    });
    setSemesters((prev) => [...prev, { ...d.semester, courses: [] }].sort((a, b) => a.term - b.term));
    setNewTerm(String(Number(newTerm) + 1));
    setNewLabel('');
    setNewIps('');
  }

  async function saveTargets(e: FormEvent) {
    e.preventDefault();
    const d = await api<{ plan: Plan }>(`/api/plans/${planId}`, {
      method: 'PATCH',
      body: JSON.stringify({ totalCreditsTarget: Number(editTotal), ipkTarget: Number(editIpk) }),
    });
    setPlan((p) => (p ? { ...p, ...d.plan } : p));
  }

  if (loading) return <div className="center muted">Memuat…</div>;
  if (!plan) return <div className="center muted">Plan tidak ditemukan.</div>;

  return (
    <div className="shell">
      <header>
        <Link to="/">← Plans</Link>
        <span className="spacer" />
      </header>

      <div className="card">
        <div className="sem-head">
          <h2>{plan.name}</h2>
        </div>
        <form className="row" onSubmit={saveTargets}>
          <label>
            Total SKS target
            <input
              type="number"
              min={1}
              max={400}
              value={editTotal}
              onChange={(e) => setEditTotal(e.target.value)}
            />
          </label>
          <label>
            IPK target
            <input
              type="number"
              step="0.01"
              min={0}
              max={4}
              value={editIpk}
              onChange={(e) => setEditIpk(e.target.value)}
            />
          </label>
          <button type="submit">Simpan target</button>
        </form>
      </div>

      {error && <p className="error">{error}</p>}

      {view && (
        <div className="mt">
          <PredictionPanel title="Prediksi Kumulatif (IPK)" prediction={view.cumulative} />
          <InsightPanel insight={view.cumulativeInsight} />
        </div>
      )}

      <div className="sem-head mt">
        <h2>Semester</h2>
      </div>

      <form className="row card" onSubmit={addSemester}>
        <label>
          Semester ke
          <input
            type="number"
            min={1}
            max={16}
            style={{ width: '5rem' }}
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
          />
        </label>
        <label style={{ flex: 1 }}>
          Label (opsional)
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="mis. Semester 3" />
        </label>
        <label>
          Target IPS (opsional)
          <input
            type="number"
            step="0.01"
            min={0}
            max={4}
            style={{ width: '6rem' }}
            value={newIps}
            onChange={(e) => setNewIps(e.target.value)}
            placeholder="—"
          />
        </label>
        <button className="primary" type="submit">
          Tambah semester
        </button>
      </form>

      {view &&
        view.semesters.map((s) => (
          <SemesterCard
            key={s.id}
            semester={s}
            letters={letters}
            scale={scale}
            onGradeChange={setCourseGrade}
            onAddCourse={addCourse}
            onDeleteCourse={deleteCourse}
            onUpdateIpsTarget={updateIpsTarget}
          />
        ))}
    </div>
  );
}