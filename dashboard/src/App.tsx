import { useEffect, useState } from 'react';
import type { DashboardData, MetricKey } from './types';
import { MetricToggle } from './components/MetricToggle';
import { MetricChart } from './components/MetricChart';
import './App.css';

const R2_BASE_URL = import.meta.env.VITE_R2_BASE_URL ?? '';

type Site = 'lv' | 'md';

const SITES: { id: Site; label: string; file: string }[] = [
  { id: 'lv', label: 'La Vanguardia', file: 'dashboard-data-lv.json' },
  { id: 'md', label: 'Mundo Deportivo', file: 'dashboard-data-md.json' },
];

export default function App() {
  const [site, setSite] = useState<Site>('lv');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<MetricKey>('lcp');

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
    ? new Date(data.generatedAt).toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
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
                className={`site-btn${site === s.id ? ' active' : ''}`}
                onClick={() => setSite(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
          {updatedAt && <span className="updated">Actualizado: {updatedAt}</span>}
        </div>
      </header>

      <main className="main">
        {loading && <p className="state-msg">Cargando datos...</p>}
        {error && <p className="state-msg error">Error al cargar datos: {error}</p>}

        {data && (
          <>
            <MetricToggle activeMetric={activeMetric} onSelect={setActiveMetric} />

            <section className="chart-section">
              <MetricChart data={data} activeMetric={activeMetric} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
