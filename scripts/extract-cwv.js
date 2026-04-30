/**
 * Extrae métricas CWV de un Lighthouse Result (LHR) y devuelve
 * el objeto metrics.json estructurado listo para subir a R2.
 */

function getAudit(lhr, id) {
  const a = lhr.audits?.[id];
  if (!a) return null;
  return {
    value: a.numericValue ?? null,
    score: a.score ?? null,
    displayValue: a.displayValue ?? null,
  };
}

export function extractCwv(lhr, { slug, url, label, timestamp }) {
  const runDate = timestamp.slice(0, 10); // "YYYY-MM-DD"

  const lcpElementItem =
    lhr.audits?.['largest-contentful-paint-element']?.details?.items?.[0];
  const lcpElement =
    lcpElementItem?.node?.snippet ?? lcpElementItem?.node?.nodeLabel ?? null;

  const reportUrl =
    `${process.env.R2_BASE_URL ?? ''}/reports-url/${encodeURIComponent(slug)}/${timestamp}/report.html`;

  return {
    slug,
    url,
    label,
    runDate,
    timestamp,
    performanceScore: lhr.categories?.performance?.score != null
      ? Math.round(lhr.categories.performance.score * 100)
      : null,
    lcp: getAudit(lhr, 'largest-contentful-paint'),
    fcp:        getAudit(lhr, 'first-contentful-paint'),
    cls:        getAudit(lhr, 'cumulative-layout-shift'),
    tbt:        getAudit(lhr, 'total-blocking-time'),
    tti:        getAudit(lhr, 'interactive'),
    speedIndex: getAudit(lhr, 'speed-index'),
    inp:        getAudit(lhr, 'interaction-to-next-paint'),
    lcpElement,
    reportUrl,
  };
}
