import { useEffect, useState } from "react";
import type { DashboardData, MetricKey } from "./types";
import { MetricToggle } from "./components/MetricToggle";
import { MetricChart } from "./components/MetricChart";
import urlsLv from "../../configs/urls-lv.json";
import urlsMd from "../../configs/urls-md.json";
import "./App.css";

const R2_BASE_URL = import.meta.env.VITE_R2_BASE_URL ?? "";

type Site = "lv" | "md";
export type DateRange = "7d" | "30d" | "90d" | "all";

const DATE_RANGES: { id: DateRange; label: string }[] = [
  { id: "7d",  label: "7 días" },
  { id: "30d", label: "30 días" },
  { id: "90d", label: "90 días" },
  { id: "all", label: "Todo" },
];

const SITES: { id: Site; label: string; file: string }[] = [
  { id: "lv", label: "La Vanguardia", file: "dashboard-data-lv.json" },
  { id: "md", label: "Mundo Deportivo", file: "dashboard-data-md.json" },
];

const CONFIG_URLS: Record<Site, { slug: string; label: string; url: string }[]> = {
  lv: urlsLv,
  md: urlsMd,
};

export default function App() {
  const [site, setSite] = useState<Site>("lv");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<MetricKey>("lcp");
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  useEffect(() => {
    const current = SITES.find((s) => s.id === site)!;
    setData(null);
    setLoading(true);
    setError(null);

    fetch(`${R2_BASE_URL}/reports-url/${current.file}?t=${Date.now()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<DashboardData>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [site]);

  const updatedAt = data
    ? new Date(data.generatedAt).toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <h1 className="title">CWV Dashboard</h1>
          <nav className="site-nav">
            {SITES.map((s) => (
              <button
                key={s.id}
                className={`site-btn${site === s.id ? " active" : ""}`}
                onClick={() => setSite(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
          {updatedAt && (
            <span className="updated">Actualizado: {updatedAt}</span>
          )}
        </div>
      </header>

      <main className="main">
        {loading && <p className="state-msg">Cargando datos...</p>}
        {error && (
          <p className="state-msg error">Error al cargar datos: {error}</p>
        )}

        {data && (
          <>
            <MetricToggle
              activeMetric={activeMetric}
              onSelect={setActiveMetric}
            />

            <section className="chart-section">
              <div className="chart-section-header">
                <nav className="range-nav">
                  {DATE_RANGES.map((r) => (
                    <button
                      key={r.id}
                      className={`range-btn${dateRange === r.id ? " active" : ""}`}
                      onClick={() => setDateRange(r.id)}
                    >
                      {r.label}
                    </button>
                  ))}
                </nav>
              </div>
              <MetricChart data={data} activeMetric={activeMetric} dateRange={dateRange} />
            </section>

            <details className="url-details">
              <summary className="url-summary">
                URLs monitorizadas ({CONFIG_URLS[site].length})
              </summary>
              <table className="url-table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>URL</th>
                  </tr>
                </thead>
                <tbody>
                  {CONFIG_URLS[site].map((u) => (
                    <tr key={u.slug}>
                      <td>{u.label}</td>
                      <td>
                        <a
                          href={u.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {u.url}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </main>
    </div>
  );
}
