import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { UrlData } from '../types';

interface Props {
  urls: UrlData[];
}

const PHASE_COLORS = {
  ttfb:         '#60a5fa',
  loadDelay:    '#fb923c',
  loadDuration: '#a78bfa',
  renderDelay:  '#f87171',
};

const PHASE_LABELS = {
  ttfb:         'TTFB',
  loadDelay:    'Load Delay',
  loadDuration: 'Load Duration',
  renderDelay:  'Render Delay',
};

export function LcpBreakdownChart({ urls }: Props) {
  const urlsWithPhases = urls.filter((u) =>
    u.runs.some((r) => r.lcp?.phases != null),
  );

  if (urlsWithPhases.length === 0) {
    return (
      <p className="no-data">
        No hay datos de sub-partes LCP disponibles.
      </p>
    );
  }

  return (
    <div className="lcp-breakdown">
      <h2 className="section-title">LCP — Sub-partes</h2>
      {urlsWithPhases.map((urlData) => {
        const runsWithPhases = urlData.runs.filter((r) => r.lcp?.phases != null);
        const chartData = runsWithPhases
          .map((r) => ({
            date: (() => {
              const datePart = r.timestamp.slice(0, 10);
              const [, m, d] = datePart.split('-');
              const sameDayCount = runsWithPhases.filter((x) => x.timestamp.startsWith(datePart)).length;
              if (sameDayCount > 1) {
                return `${d}/${m} ${r.timestamp.slice(11, 16)}`;
              }
              return `${d}/${m}`;
            })(),
            ttfb:         r.lcp!.phases!.ttfb         ?? 0,
            loadDelay:    r.lcp!.phases!.loadDelay     ?? 0,
            loadDuration: r.lcp!.phases!.loadDuration  ?? 0,
            renderDelay:  r.lcp!.phases!.renderDelay   ?? 0,
          }));

        return (
          <div key={urlData.slug} className="lcp-breakdown-chart">
            <h3 className="chart-label">{urlData.label}</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}s`}
                  width={45}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    `${v} ms`,
                    PHASE_LABELS[name as keyof typeof PHASE_LABELS] ?? name,
                  ]}
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Legend
                  formatter={(v) => PHASE_LABELS[v as keyof typeof PHASE_LABELS] ?? v}
                  wrapperStyle={{ fontSize: 11 }}
                />
                {(Object.keys(PHASE_COLORS) as Array<keyof typeof PHASE_COLORS>).map((phase) => (
                  <Bar key={phase} dataKey={phase} stackId="lcp" fill={PHASE_COLORS[phase]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}
