import { useEffect, useState } from 'react';
import type { DashboardData, MetricKey } from './types';
import { MetricToggle } from './components/MetricToggle';
import { MetricChart } from './components/MetricChart';
import { LcpBreakdownChart } from './components/LcpBreakdownChart';
import './App.css';

const R2_BASE_URL = import.meta.env.VITE_R2_BASE_URL ?? '';

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<MetricKey>('lcp');

  useEffect(() => {
    fetch(`${R2_BASE_URL}/reports-url/dashboard-data.json?t=${Date.now()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<DashboardData>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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

            {activeMetric === 'lcp' && (
              <LcpBreakdownChart urls={data.urls} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
