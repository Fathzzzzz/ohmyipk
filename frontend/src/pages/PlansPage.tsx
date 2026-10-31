import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Plan } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/http';

export default function PlansPage() {
  const { user, logout } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState('');
  const [total, setTotal] = useState('144');
  const [ipk, setIpk] = useState('3.50');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ plans: Plan[] }>('/api/plans')
      .then((d) => setPlans(d.plans))
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat'));
  }, []);

  async function createPlan(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const d = await api<{ plan: Plan }>('/api/plans', {
      method: 'POST',
      body: JSON.stringify({
        name,
        totalCreditsTarget: Number(total),
        ipkTarget: Number(ipk),
      }),
    });
    setPlans((p) => [d.plan, ...p]);
    setName('');
  }

  return (
    <div className="shell">
      <header>
        <h1>OhMyIPK</h1>
        <div className="spacer" />
        <span className="muted">{user?.name}</span>
        <button className="ghost" onClick={() => void logout()} type="button">
          Keluar
        </button>
      </header>

      <div className="card">
        <h2>Buat Study Plan Baru</h2>
        <form className="row" onSubmit={createPlan}>
          <input
            placeholder="Nama plan, mis. Rencana S1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <label className="inline">
            Target SKS
            <input
              type="number"
              min={1}
              max={400}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </label>
          <label className="inline">
            Target IPK
            <input
              type="number"
              step="0.01"
              min={0}
              max={4}
              value={ipk}
              onChange={(e) => setIpk(e.target.value)}
            />
          </label>
          <button className="primary" type="submit">
            Buat
          </button>
        </form>
      </div>

      {error && <p className="error">{error}</p>}

      <h2>Study Plans</h2>
      {plans.length === 0 ? (
        <p className="muted">Belum ada plan. Buat satu di atas.</p>
      ) : (
        <ul className="plan-list">
          {plans.map((p) => (
            <li key={p.id}>
              <Link className="card plan-card" to={`/plans/${p.id}`}>
                <div>
                  <strong>{p.name}</strong>
                  <div className="muted">
                    Target {p.totalCreditsTarget} SKS · IPK {p.ipkTarget.toFixed(2)}
                  </div>
                </div>
                <div className="muted">{p._count?.semesters ?? 0} semester</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}