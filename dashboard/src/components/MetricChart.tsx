import { useState, useEffect } from "react";
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
} from "recharts";
import { METRICS, URL_COLORS } from "../types";
import type { DashboardData, MetricKey, RunMetrics } from "../types";
import type { DateRange } from "../App";
import milestonesConfig from "../milestones.json";

interface MilestoneConfig {
  date: string;
  label: string;
  color?: string;
}

interface Props {
  data: DashboardData;
  activeMetric: MetricKey;
  dateRange: DateRange;
}

function getMetricValue(run: RunMetrics, key: MetricKey): number | null {
  if (key === "performanceScore") return run.performanceScore;
  const m = run[key] as { value: number | null } | null;
  return m?.value ?? null;
}

function getDisplayValue(run: RunMetrics, key: MetricKey): string {
  if (key === "performanceScore") {
    return run.performanceScore != null ? String(run.performanceScore) : "N/A";
  }
  const m = run[key] as { displayValue: string | null } | null;
  return m?.displayValue ?? "N/A";
}

function getScore(run: RunMetrics, key: MetricKey): number | null {
  if (key === "performanceScore") return null;
  const m = run[key] as { score: number | null } | null;
  return m?.score ?? null;
}

function scoreColor(score: number | null): string {
  if (score == null) return "#9ca3af";
  if (score >= 0.9) return "#22c55e";
  if (score >= 0.5) return "#f59e0b";
  return "#ef4444";
}

const CustomTooltip = ({
  active,
  payload,
  label,
  activeMetric,
  hoveredSlug,
}: {
  active?: boolean;
  payload?: Array<{
    color: string;
    name: string;
    value: number;
    dataKey: string;
    payload: Record<string, unknown>;
  }>;
  label?: string;
  activeMetric: MetricKey;
  hoveredSlug: string | null;
}) => {
  if (!active || !payload?.length) return null;
  const meta = METRICS.find((m) => m.key === activeMetric)!;

  const activeEntry = hoveredSlug
    ? payload.find((e) => e.dataKey === hoveredSlug)
    : null;
  const activeRun = activeEntry
    ? (activeEntry.payload[`__run_${hoveredSlug}`] as RunMetrics | undefined)
    : null;
  const reportUrl = activeRun?.reportUrl;

  return (
    <div className="chart-tooltip">
      <p className="tooltip-date">
        {(() => {
          if (!label) return label;
          const [datePart, timePart] = label.split("_");
          const [y, m, d] = datePart.split("-");
          const hh = timePart?.slice(0, 2) ?? "";
          const mm = timePart?.slice(2, 4) ?? "";
          return timePart ? `${d}/${m}/${y} ${hh}:${mm}` : `${d}/${m}/${y}`;
        })()}
      </p>
      {payload.map((entry) => {
        const run = entry.payload[`__run_${entry.dataKey}`] as
          | RunMetrics
          | undefined;
        if (!run) return null;
        const display = getDisplayValue(run, activeMetric);
        const score = getScore(run, activeMetric);
        const isHovered = entry.dataKey === hoveredSlug;
        return (
          <div key={entry.name} className="tooltip-row">
            <span className="tooltip-dot" style={{ background: entry.color }} />
            <span
              className="tooltip-label"
              style={{
                fontWeight: isHovered ? 700 : 400,
                color: isHovered ? "#fff" : undefined,
              }}
            >
              {entry.name}
            </span>
            <span className="tooltip-value">
              {display}
              {meta.unit && display !== "N/A" ? "" : ""}
            </span>
            {score != null && (
              <span
                className="tooltip-score"
                style={{ color: scoreColor(score) }}
              >
                ●
              </span>
            )}
          </div>
        );
      })}
      {reportUrl && (
        <div
          style={{
            textAlign: "center",
            marginTop: 8,
            paddingTop: 6,
            borderTop: "1px solid #374151",
          }}
        >
          <a
            className="tooltip-link"
            href={reportUrl}
            target="_blank"
            rel="noreferrer"
          >
            open report ↗
          </a>
        </div>
      )}
    </div>
  );
};

const MA_WINDOW = 7;

function computeRollingAvg(values: (number | null)[]): (number | null)[] {
  return values.map((_, i) => {
    const slice = values
      .slice(Math.max(0, i - MA_WINDOW + 1), i + 1)
      .filter((v): v is number => v != null);
    return slice.length >= 2 ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
  });
}

export function MetricChart({ data, activeMetric, dateRange }: Props) {
  const meta = METRICS.find((m) => m.key === activeMetric)!;
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [showMA, setShowMA] = useState(false);

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

  const cutoffDate =
    dateRange === "all"
      ? null
      : (() => {
          const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
          const d = new Date();
          d.setDate(d.getDate() - days);
          return d.toISOString().slice(0, 10);
        })();

  // Construir dataset: una entrada por timestamp único (permite múltiples auditorías el mismo día)
  const allTimestamps = Array.from(
    new Set(data.urls.flatMap((u) => u.runs.map((r) => r.timestamp))),
  )
    .sort()
    .filter((ts) => cutoffDate === null || ts.slice(0, 10) >= cutoffDate);

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

  // Rolling average per slug (MA_WINDOW runs)
  data.urls.forEach((urlData) => {
    const values = chartData.map((e) => {
      const v = e[urlData.slug];
      return typeof v === "number" ? v : null;
    });
    const avgs = computeRollingAvg(values);
    avgs.forEach((avg, i) => {
      chartData[i][`${urlData.slug}__ma`] = avg;
    });
  });

  // Resolver cada hito al timestamp más cercano, descartando los que quedan fuera del rango de datos
  const milestones = (milestonesConfig as MilestoneConfig[]).flatMap((m) => {
    if (allTimestamps.length === 0) return [];
    const mTime = new Date(m.date).getTime();
    const firstTime = new Date(allTimestamps[0]).getTime();
    const lastTime = new Date(
      allTimestamps[allTimestamps.length - 1],
    ).getTime();
    if (mTime < firstTime || mTime > lastTime) return [];
    const exact = allTimestamps.find((ts) => ts.startsWith(m.date));
    if (exact) return [{ ...m, ts: exact }];
    const nearest = allTimestamps.reduce((prev, curr) =>
      Math.abs(new Date(curr).getTime() - mTime) <
      Math.abs(new Date(prev).getTime() - mTime)
        ? curr
        : prev,
    );
    return [{ ...m, ts: nearest }];
  });

  // Rango del eje Y con margen (solo valores visibles tras el filtro de fechas y slugs activos)
  const visibleSlugs =
    selectedSlugs.size > 0
      ? selectedSlugs
      : new Set(data.urls.map((u) => u.slug));
  const visibleTimestampSet = new Set(allTimestamps);
  const allValues = data.urls
    .filter((u) => visibleSlugs.has(u.slug))
    .flatMap((u) =>
      u.runs
        .filter((r) => visibleTimestampSet.has(r.timestamp))
        .map((r) => getMetricValue(r, activeMetric))
        .filter((v): v is number => v != null),
    );
  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const maxVal = allValues.length ? Math.max(...allValues) : t2 * 1.5;
  const yMin = Math.max(0, minVal * 0.85);
  const yMax = maxVal * 1.15;

  // Bandas de color (verde / amarillo / rojo)
  const goodTop = meta.higherIsBetter ? yMax : t1;
  const goodBottom = meta.higherIsBetter ? t1 : yMin;
  const warnTop = meta.higherIsBetter ? t1 : t2;
  const warnBottom = meta.higherIsBetter ? t2 : t1;
  const badTop = meta.higherIsBetter ? t2 : yMax;
  const badBottom = meta.higherIsBetter ? yMin : t2;

  return (
    <div>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
          onMouseLeave={() => setHoveredSlug(null)}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

          {/* Bandas Web Vitals */}
          <ReferenceArea
            y1={goodBottom}
            y2={goodTop}
            fill="rgba(34,197,94,0.08)"
            ifOverflow="hidden"
          />
          <ReferenceArea
            y1={warnBottom}
            y2={warnTop}
            fill="rgba(245,158,11,0.12)"
            ifOverflow="hidden"
          />
          <ReferenceArea
            y1={badBottom}
            y2={badTop}
            fill="rgba(239,68,68,0.1)"
            ifOverflow="hidden"
          />

          <XAxis
            dataKey="date"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={(v: string) => {
              const datePart = v.slice(0, 10);
              const [, m, d] = datePart.split("-");
              const sameDayCount = allTimestamps.filter((t) =>
                t.startsWith(datePart),
              ).length;
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
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={(v: number) =>
              meta.unit === "ms" ? `${(v / 1000).toFixed(1)}s` : String(v)
            }
            width={50}
          />
          <Tooltip
            content={
              <CustomTooltip
                activeMetric={activeMetric}
                hoveredSlug={hoveredSlug}
              />
            }
          />

          {milestones.map((m) => (
            <ReferenceLine
              key={`${m.ts}-${m.label}`}
              x={m.ts}
              stroke={m.color ?? "#a78bfa"}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: m.label,
                position: "insideTopRight",
                fill: m.color ?? "#a78bfa",
                fontSize: 10,
                fontWeight: 500,
              }}
            />
          ))}

          {/* Rolling average lines — rendered first so raw dots appear on top */}
          {data.urls.map((urlData, i) => {
            const stroke = URL_COLORS[i % URL_COLORS.length];
            return (
              <Line
                key={`${urlData.slug}__ma`}
                type="monotone"
                dataKey={`${urlData.slug}__ma`}
                stroke={stroke}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                activeDot={false}
                connectNulls={false}
                legendType="none"
                hide={
                  !showMA ||
                  (selectedSlugs.size > 0 && !selectedSlugs.has(urlData.slug))
                }
              />
            );
          })}

          {data.urls.map((urlData, i) => {
            const stroke = URL_COLORS[i % URL_COLORS.length];
            return (
              <Line
                key={urlData.slug}
                type="monotone"
                dataKey={urlData.slug}
                name={urlData.label}
                stroke={stroke}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={(props: unknown) => {
                  const { cx, cy, payload } = props as {
                    cx: number;
                    cy: number;
                    payload: Record<string, unknown>;
                  };
                  const run = payload[`__run_${urlData.slug}`] as
                    | RunMetrics
                    | undefined;
                  const url = run?.reportUrl;
                  return (
                    <circle
                      key={`dot-${urlData.slug}-${payload.date}`}
                      cx={cx}
                      cy={cy}
                      r={6}
                      fill={stroke}
                      stroke="#fff"
                      strokeWidth={2}
                      style={{ cursor: url ? "pointer" : "default" }}
                      onMouseEnter={() => setHoveredSlug(urlData.slug)}
                      onClick={() => url && window.open(url, "_blank")}
                    />
                  );
                }}
                connectNulls={false}
                hide={
                  selectedSlugs.size > 0 && !selectedSlugs.has(urlData.slug)
                }
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "center",
          paddingTop: 10,
        }}
      >
        <button
          onClick={() => setShowMA((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: showMA ? "#e5e7eb" : "#6b7280",
            background: showMA ? "#1f2937" : "transparent",
            border: `1px solid ${showMA ? "#4b5563" : "#374151"}`,
            borderRadius: 4,
            padding: "2px 8px",
            cursor: "pointer",
            marginRight: 4,
            transition: "all 0.15s",
          }}
        >
          <svg width="18" height="6">
            <line
              x1="0" y1="3" x2="18" y2="3"
              stroke={showMA ? "#e5e7eb" : "#6b7280"}
              strokeWidth="2"
              strokeDasharray="6 3"
            />
          </svg>
          <span>avg {MA_WINDOW} runs</span>
        </button>
        {data.urls.map((urlData, i) => {
          const color = URL_COLORS[i % URL_COLORS.length];
          const isSelected = selectedSlugs.has(urlData.slug);
          const isActive = selectedSlugs.size === 0 || isSelected;
          return (
            <div
              key={urlData.slug}
              onClick={() => handleLegendClick(urlData.slug)}
              style={{
                cursor: "pointer",
                opacity: isActive ? 1 : 0.3,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: isSelected && selectedSlugs.size > 0 ? 700 : 400,
                transition: "opacity 0.15s",
                userSelect: "none",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 18,
                  height: 3,
                  background: color,
                  borderRadius: 2,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "#d1d5db" }}>{urlData.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
