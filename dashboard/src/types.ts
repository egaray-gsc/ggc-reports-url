export interface MetricValue {
  value: number | null;
  score: number | null;
  displayValue: string | null;
}

export interface RunMetrics {
  slug: string;
  url: string;
  label: string;
  runDate: string;
  timestamp: string;
  performanceScore: number | null;
  lcp: MetricValue | null;
  fcp: MetricValue | null;
  cls: MetricValue | null;
  tbt: MetricValue | null;
  tti: MetricValue | null;
  speedIndex: MetricValue | null;
  inp: MetricValue | null;
  lcpElement: string | null;
  reportUrl: string;
}

export interface UrlData {
  slug: string;
  label: string;
  url: string;
  runs: RunMetrics[];
}

export interface DashboardData {
  generatedAt: string;
  urls: UrlData[];
}

export type MetricKey =
  | 'lcp'
  | 'fcp'
  | 'cls'
  | 'tbt'
  | 'tti'
  | 'speedIndex'
  | 'inp'
  | 'performanceScore';

export interface MetricMeta {
  key: MetricKey;
  label: string;
  unit: string;
  /** [good, needsImprovement] thresholds. For performanceScore higher is better, thresholds inverted. */
  thresholds: [number, number];
  higherIsBetter: boolean;
}

export const METRICS: MetricMeta[] = [
  { key: 'lcp',              label: 'LCP',         unit: 'ms', thresholds: [2500, 4000], higherIsBetter: false },
  { key: 'fcp',              label: 'FCP',         unit: 'ms', thresholds: [1800, 3000], higherIsBetter: false },
  { key: 'cls',              label: 'CLS',         unit: '',   thresholds: [0.1, 0.25],  higherIsBetter: false },
  { key: 'tbt',              label: 'TBT',         unit: 'ms', thresholds: [200, 600],   higherIsBetter: false },
  { key: 'tti',              label: 'TTI',         unit: 'ms', thresholds: [3800, 7300], higherIsBetter: false },
  { key: 'speedIndex',       label: 'Speed Index', unit: 'ms', thresholds: [3400, 5800], higherIsBetter: false },
  { key: 'inp',              label: 'INP',         unit: 'ms', thresholds: [200, 500],   higherIsBetter: false },
  { key: 'performanceScore', label: 'Score',       unit: '',   thresholds: [90, 50],     higherIsBetter: true  },
];

export const URL_COLORS = [
  '#60a5fa', '#34d399', '#f472b6', '#fbbf24',
  '#a78bfa', '#fb923c', '#4ade80', '#f87171',
];
