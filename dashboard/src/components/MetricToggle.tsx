import { METRICS } from '../types';
import type { MetricKey } from '../types';

interface Props {
  activeMetric: MetricKey;
  onSelect: (key: MetricKey) => void;
}

export function MetricToggle({ activeMetric, onSelect }: Props) {
  return (
    <div className="metric-toggle">
      {METRICS.map((m) => (
        <button
          key={m.key}
          className={`toggle-btn${activeMetric === m.key ? ' active' : ''}`}
          onClick={() => onSelect(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
