import type { Status } from '@ohmyipk/calc';

const LABEL: Record<Status, string> = {
  AMAN: 'AMAN',
  KETAT: 'KETAT',
  GAGAL: 'GAGAL',
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{LABEL[status]}</span>;
}