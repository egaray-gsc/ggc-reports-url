import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { METRICS, URL_COLORS } from '../types';
import type { DashboardData, MetricKey, RunMetrics } from '../types';
import milestonesConfig from '../milestones.json';

interface MilestoneConfig {
  date: string;
  label: string;
  color?: string;
}

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
  payload?: Array<{ color: string; name: string; value: number; dataKey: string; payload: Record<string, unknown> }>;
  label?: string;
  activeMetric: MetricKey;
}) => {
  if (!active || !payload?.length) return null;
  const meta = METRICS.find((m) => m.key === activeMetric)!;

  return (
    <div className="chart-tooltip">
      <p className="tooltip-date">{label}</p>
      {payload.map((entry) => {
        const run = entry.payload[`__run_${entry.dataKey}`] as RunMetrics | undefined;
        if (!run) return null;
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
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedSlugs(new Set());
  }, [data]);

  const handleLegendClick = (slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

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

  // Resolver cada hito al timestamp más cercano disponible en los datos
  const milestones = (milestonesConfig as MilestoneConfig[]).flatMap((m) => {
    if (allTimestamps.length === 0) return [];
    const exact = allTimestamps.find((ts) => ts.startsWith(m.date));
    if (exact) return [{ ...m, ts: exact }];
    const mTime = new Date(m.date).getTime();
    const nearest = allTimestamps.reduce((prev, curr) =>
      Math.abs(new Date(curr).getTime() - mTime) < Math.abs(new Date(prev).getTime() - mTime)
        ? curr
        : prev,
    );
    return [{ ...m, ts: nearest }];
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
    <div>
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
              const hh = v.slice(11, 13);
              const mm = v.slice(13, 15);
              return `${d}/${m} ${hh}:${mm}`;
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

        {milestones.map((m) => (
          <ReferenceLine
            key={`${m.ts}-${m.label}`}
            x={m.ts}
            stroke={m.color ?? '#a78bfa'}
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: m.label,
              position: 'insideTopRight',
              fill: m.color ?? '#a78bfa',
              fontSize: 10,
              fontWeight: 500,
            }}
          />
        ))}

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
            hide={selectedSlugs.size > 0 && !selectedSlugs.has(urlData.slug)}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', paddingTop: 10 }}>
      {data.urls.map((urlData, i) => {
        const color = URL_COLORS[i % URL_COLORS.length];
        const isSelected = selectedSlugs.has(urlData.slug);
        const isActive = selectedSlugs.size === 0 || isSelected;
        return (
          <div
            key={urlData.slug}
            onClick={() => handleLegendClick(urlData.slug)}
            style={{
              cursor: 'pointer',
              opacity: isActive ? 1 : 0.3,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: isSelected && selectedSlugs.size > 0 ? 700 : 400,
              transition: 'opacity 0.15s',
              userSelect: 'none',
            }}
          >
            <span style={{ display: 'inline-block', width: 18, height: 3, background: color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ color: '#d1d5db' }}>{urlData.label}</span>
          </div>
        );
      })}
    </div>
  </div>
  );
}
