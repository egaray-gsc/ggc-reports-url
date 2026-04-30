import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import { METRICS, URL_COLORS } from '../types';
import type { DashboardData, MetricKey, RunMetrics } from '../types';

interface Props {
  data: DashboardData;
  activeMetric: MetricKey;
}

function getMetricValue(run: RunMetrics, key: MetricKey): number | null {
  if (key === 'performanceScore') return run.performanceScore;
  const m = run[key] as { value: number | null } | null;
  return m?.value ?? null;
}

function getDisplayValue(run: RunMetrics, key: MetricKey): string {
  if (key === 'performanceScore') {
    return run.performanceScore != null ? String(run.performanceScore) : 'N/A';
  }
  const m = run[key] as { displayValue: string | null } | null;
  return m?.displayValue ?? 'N/A';
}

function getScore(run: RunMetrics, key: MetricKey): number | null {
  if (key === 'performanceScore') return null;
  const m = run[key] as { score: number | null } | null;
  return m?.score ?? null;
}

function scoreColor(score: number | null): string {
  if (score == null) return '#9ca3af';
  if (score >= 0.9) return '#22c55e';
  if (score >= 0.5) return '#f59e0b';
  return '#ef4444';
}

const CustomTooltip = ({
  active,
  payload,
  label,
  activeMetric,
}: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number; payload: RunMetrics }>;
  label?: string;
  activeMetric: MetricKey;
}) => {
  if (!active || !payload?.length) return null;
  const meta = METRICS.find((m) => m.key === activeMetric)!;

  return (
    <div className="chart-tooltip">
      <p className="tooltip-date">{label}</p>
      {payload.map((entry) => {
        const run = entry.payload;
        const display = getDisplayValue(run, activeMetric);
        const score = getScore(run, activeMetric);
        return (
          <div key={entry.name} className="tooltip-row">
            <span className="tooltip-dot" style={{ background: entry.color }} />
            <span className="tooltip-label">{entry.name}</span>
            <span className="tooltip-value">
              {display}
              {meta.unit && display !== 'N/A' ? '' : ''}
            </span>
            {score != null && (
              <span className="tooltip-score" style={{ color: scoreColor(score) }}>●</span>
            )}
            {run.reportUrl && (
              <a
                className="tooltip-link"
                href={run.reportUrl}
                target="_blank"
                rel="noreferrer"
              >
                report
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
};

export function MetricChart({ data, activeMetric }: Props) {
  const meta = METRICS.find((m) => m.key === activeMetric)!;
  const [t1, t2] = meta.thresholds;

  // Construir dataset: una entrada por timestamp único (permite múltiples auditorías el mismo día)
  const allTimestamps = Array.from(
    new Set(data.urls.flatMap((u) => u.runs.map((r) => r.timestamp))),
  ).sort();

  const chartData = allTimestamps.map((ts) => {
    const entry: Record<string, unknown> = { date: ts };
    data.urls.forEach((urlData) => {
      const run = urlData.runs.find((r) => r.timestamp === ts);
      if (run) {
        entry[`__run_${urlData.slug}`] = run;
        entry[urlData.slug] = getMetricValue(run, activeMetric);
      }
    });
    return entry;
  });

  // Rango del eje Y con margen
  const allValues = data.urls.flatMap((u) =>
    u.runs.map((r) => getMetricValue(r, activeMetric)).filter((v): v is number => v != null),
  );
  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const maxVal = allValues.length ? Math.max(...allValues) : t2 * 1.5;
  const yMin = Math.max(0, minVal * 0.85);
  const yMax = maxVal * 1.15;

  // Bandas de color (verde / amarillo / rojo)
  const goodTop    = meta.higherIsBetter ? yMax  : t1;
  const goodBottom = meta.higherIsBetter ? t1    : yMin;
  const warnTop    = meta.higherIsBetter ? t1    : t2;
  const warnBottom = meta.higherIsBetter ? t2    : t1;
  const badTop     = meta.higherIsBetter ? t2    : yMax;
  const badBottom  = meta.higherIsBetter ? yMin  : t2;

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

        {/* Bandas Web Vitals */}
        <ReferenceArea y1={goodBottom} y2={goodTop} fill="rgba(34,197,94,0.08)"  ifOverflow="hidden" />
        <ReferenceArea y1={warnBottom} y2={warnTop} fill="rgba(245,158,11,0.12)" ifOverflow="hidden" />
        <ReferenceArea y1={badBottom}  y2={badTop}  fill="rgba(239,68,68,0.1)"   ifOverflow="hidden" />

        <XAxis
          dataKey="date"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          tickFormatter={(v: string) => {
            const datePart = v.slice(0, 10);
            const [, m, d] = datePart.split('-');
            const sameDayCount = allTimestamps.filter((t) => t.startsWith(datePart)).length;
            if (sameDayCount > 1) {
              const timePart = v.slice(11, 16);
              return `${d}/${m} ${timePart}`;
            }
            return `${d}/${m}`;
          }}
        />
        <YAxis
          domain={[yMin, yMax]}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          tickFormatter={(v: number) =>
            meta.unit === 'ms' ? `${(v / 1000).toFixed(1)}s` : String(v)
          }
          width={50}
        />
        <Tooltip
          content={
            <CustomTooltip activeMetric={activeMetric} />
          }
        />
        <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />

        {data.urls.map((urlData, i) => (
          <Line
            key={urlData.slug}
            type="monotone"
            dataKey={urlData.slug}
            name={urlData.label}
            stroke={URL_COLORS[i % URL_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
