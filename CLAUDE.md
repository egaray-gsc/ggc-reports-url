# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ggc-reports-url** is a Core Web Vitals (CWV) audit and monitoring system. It has two parts:

1. **Audit pipeline** — Node.js scripts that run Lighthouse on target URLs and upload results to Cloudflare R2
2. **Dashboard** — React + Vite frontend that fetches and visualizes the historical performance data

Companion repo `ggc-reports-ci` lives alongside this one in the VSCode workspace (`reports-ws.code-workspace`).

## Commands

**Audit pipeline (root):**
```bash
npm run audit          # Run Lighthouse audit — requires --slug and --timestamp args
npm run aggregate      # Aggregate all R2 metrics into dashboard-data.json
npm run test:cookies   # Test cookie acceptance logic
```

**Dashboard (`cd dashboard` first):**
```bash
npm run dev      # Start Vite dev server
npm run build    # tsc -b && vite build
npm run lint     # ESLint
npm run preview  # Preview production build locally
```

## Environment Setup

Copy `.env.example` to `.env` and fill in Cloudflare R2 credentials:
```
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_ENDPOINT=https://<accountId>.r2.cloudflarestorage.com
R2_BASE_URL=https://<public-url>
```

The dashboard build also requires `VITE_R2_BASE_URL` at build time (injected as env var or via GitHub Actions secret).

## Architecture

### Data Flow

```
configs/urls.json
  → run-audit.js (per slug + timestamp)
      ├── accept-cookies.js       # Handles consent banners (Didomi, OneTrust, etc.)
      ├── Puppeteer + Lighthouse  # Headless Chrome, mobile config, simulated throttling
      └── upload-r2.js            # Stores metrics.json + report.html
  → aggregate-metrics.js
      └── upload-r2.js            # Stores dashboard-data.json
  → Dashboard (React)
      └── Fetches dashboard-data.json and renders charts
```

### R2 Storage Structure

```
reports-url/
  {slug}/{timestamp}/metrics.json       # Per-audit CWV metrics
  {slug}/{timestamp}/report.html        # Full Lighthouse HTML report
  dashboard-data.json                   # Aggregated timeseries (5-min cache)
```

### Key Script Responsibilities

- **run-audit.js** — Orchestrator: injects cookies/localStorage, runs `startFlow()`, calls extract + upload
- **accept-cookies.js** — Detects and clicks consent buttons; persists cookies to `/tmp/consent-cookies-{slug}.json`
- **extract-cwv.js** — Parses LHR JSON to extract CWV metrics and LCP sub-phases (TTFB, Load Delay, Load Duration, Render Delay)
- **upload-r2.js** — S3-compatible R2 uploads; two functions: `uploadReport()` and `uploadDashboardData()`
- **aggregate-metrics.js** — Scans all R2 objects, groups by slug, outputs `dashboard-data.json`

### Dashboard Components

- **App.tsx** — Fetches `dashboard-data.json`, manages selected metric state
- **MetricChart.tsx** — Recharts line chart with Web Vitals threshold bands (green/yellow/red) and links to individual reports
- **LcpBreakdownChart.tsx** — Recharts stacked bar chart showing LCP phase breakdown per URL
- **types.ts** — Central place for `MetricKey`, `RunMetrics`, `DashboardData` types and threshold values

### Lighthouse Configuration

Audits run mobile-first (375×812, 3× density, simulated throttling). Storage reset is disabled so injected cookies/localStorage persist across navigation. Only the performance category is audited.

## CI/CD

- **cwv-audit.yml** — Manual trigger; matrix of slugs runs in parallel; generates Madrid-timezone timestamp
- **deploy-dashboard.yml** — Auto-triggers on `main` when `dashboard/**` changes; builds and deploys to GitHub Pages at base path `/ggc-reports-url/`

## Target URLs

Defined in `configs/urls.json`. Each entry has `slug`, `url`, `label`, and `cookieDomain`. The slug is used as the R2 folder name and must be unique.
