import { formatGpa, formatWeight, weightToGpa, type Prediction } from '@ohmyipk/calc';
import { StatusBadge } from './StatusBadge';

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

export function PredictionPanel({
  title,
  prediction,
}: {
  title: string;
  prediction: Prediction;
}) {
  const lossPerCredit =
    prediction.remainingCredits > 0
      ? weightToGpa(prediction.lossBudget / prediction.remainingCredits)
      : 0;

  return (
    <div className="card">
      <div className="sem-head">
        <h3>{title}</h3>
        <StatusBadge status={prediction.status} />
      </div>
      <div className="grid">
        <Stat k="Target" v={formatGpa(prediction.target)} />
        <Stat k="Saat ini" v={formatGpa(prediction.current)} />
        <Stat k="Maks. mungkin" v={formatGpa(prediction.maxPossible)} />
        <Stat k="Rata-rata dibutuhkan" v={formatWeight(prediction.requiredWeight)} />
        <Stat k="Nilai minimal jujur" v={prediction.minRequiredLetter ?? '—'} />
        <Stat k="SKS sisa" v={String(prediction.remainingCredits)} />
      </div>
      <p className="muted small mt">
        Anggaran kehilangan:{' '}
        <strong>{prediction.lossBudget}</strong> poin
        {prediction.remainingCredits > 0 && prediction.lossBudget >= 0 && (
          <> (boleh turun ≈ {lossPerCredit.toFixed(2)} per SKS sisa)</>
        )}
        .
      </p>
    </div>
  );
}