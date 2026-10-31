import { formatGpa, type CombinationInsight } from '@ohmyipk/calc';

export function InsightPanel({ insight }: { insight: CombinationInsight | null }) {
  if (!insight) return null;

  if (insight.allPass) {
    return <p className="small muted mt">Semua kombinasi nilai lolos — target sudah tercapai.</p>;
  }

  if (insight.allFail) {
    const best = insight.failing[0];
    return (
      <p className="small mt">
        Target mustahil: bahkan semua A hanya mencapai <strong>{formatGpa(best?.achieved)}</strong>.
      </p>
    );
  }

  return (
    <div className="small mt">
      <div>
        Rata-rata minimal sisa:{' '}
        <strong>{formatGpa(insight.needAverage)}</strong>
        {insight.truncated && <span className="muted"> (perkiraan)</span>}
      </div>

      <div className="mt">
        <strong>Contoh lolos:</strong>
      </div>
      {insight.passing.slice(0, 3).map((c, i) => (
        <div className="combo mt" key={`p${i}`}>
          {c.grades.map((g, j) => (
            <span className="combo-pill pass" key={j}>{g}</span>
          ))}
          <span className="muted">→ {formatGpa(c.achieved)} ✓</span>
        </div>
      ))}

      <div className="mt">
        <strong>Contoh gagal:</strong>
      </div>
      {insight.failing.slice(0, 3).map((c, i) => (
        <div className="combo mt" key={`f${i}`}>
          {c.grades.map((g, j) => (
            <span className="combo-pill fail" key={j}>{g}</span>
          ))}
          <span className="muted">→ {formatGpa(c.achieved)} ✗</span>
        </div>
      ))}
    </div>
  );
}