# ggc-reports-url

Sistema de monitoratge de Core Web Vitals (CWV) per GSC. Executa auditories Lighthouse sobre les URLs objectiu, emmagatzema els resultats a Cloudflare R2 i ofereix un tauler React amb l'evolució històrica del rendiment.

## Com funciona

```
configs/urls-{site}.json
  → scripts/run-audit.js        # Puppeteer + Lighthouse per slug
      ├── accept-cookies.js     # Gestiona els banners de consentiment Didomi / OneTrust
      ├── extract-cwv.js        # Analitza LHR → metrics.json
      └── upload-r2.js          # Puja metrics.json + report.html
  → scripts/aggregate-metrics.js
      └── upload-r2.js          # Puja dashboard-data-{site}.json
  → dashboard/                  # React + Vite, desplegat a GitHub Pages
```

Les auditories s'executen amb configuració mòbil (375×812, limitació de xarxa simulada, només categoria de rendiment). La injecció de cookies persisteix entre navegacions, de manera que els banners de consentiment es gestionen abans que s'activi Lighthouse.

El multiplicador de CPU es fixa a `cpuSlowdownMultiplier: 4` en lloc de deixar que Lighthouse el calibri automàticament. Els runners de GitHub Actions són màquines compartides i la velocitat de CPU disponible varia d'una execució a una altra; amb la calibració automàtica, Lighthouse mesuraria amb un throttling diferent cada cop, introduint variabilitat que no prové del lloc. El valor 4 és el que Lighthouse utilitza per defecte per a mòbil, de manera que el nivell de simulació no canvia, però sí que es torna consistent entre runs.

Per cada slug, Lighthouse s'executa **3 vegades** i es guarda la **mediana** de cada mètrica (Performance Score, LCP, CLS, FCP, TBT, TTI, Speed Index). L'informe HTML que es puja a R2 correspon al run amb el valor de LCP medià. La mediana és preferible a la mitjana perquè és més robusta davant pics puntuals.

## Estructura d'emmagatzematge a R2

```
reports-url/
  {slug}/{timestamp}/metrics.json     # mètriques CWV per auditoria
  {slug}/{timestamp}/report.html      # informe HTML complet de Lighthouse
  dashboard-data-lv.json              # sèries temporals agregades — La Vanguardia
  dashboard-data-md.json              # sèries temporals agregades — Mundo Deportivo
```

## Llocs objectiu

| Fitxer                 | Lloc            | Slugs                                             |
| ---------------------- | --------------- | ------------------------------------------------- |
| `configs/urls-lv.json` | La Vanguardia   | Home, Story                                       |
| `configs/urls-md.json` | Mundo Deportivo | Home, Section, Story, Video Story, Solomoto Story |

## Configuració

### Requisits previs

- Node.js 22
- pnpm (`npm install -g pnpm`)

### Instal·lació

```bash
pnpm install             # arrel (pipeline d'auditoria)
cd dashboard
pnpm install             # tauler
```

## Ús

### Tauler en local

La manera habitual d'usar el projecte en local és aixecar únicament el tauler, que llegeix les mètriques ja agregades a R2.

Crea un fitxer `dashboard/.env` amb:

```
VITE_R2_BASE_URL=https://pub-2b50285893574bb786ba66cc8a9b03a8.r2.dev
```

I arrenca el servidor de desenvolupament:

```bash
cd dashboard
pnpm run dev      # http://localhost:5173
```

### Auditories i agregació de mètriques

Les auditories (`run-audit.js`) i l'agregador (`aggregate-metrics.js`) estan dissenyats per executar-se via **GitHub Actions**, on els secrets de Cloudflare R2 estan configurats com a secrets del repositori.

Per executar-los en local caldria disposar d'aquestes credencials i crear un fitxer `.env` a l'arrel del projecte:

```
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_ENDPOINT=https://<accountId>.r2.cloudflarestorage.com
R2_BASE_URL=https://<public-url>
```

## CI/CD

| Workflow               | Activació                          | Què fa                                                    |
| ---------------------- | ---------------------------------- | --------------------------------------------------------- |
| `cwv-audit-lv.yml`     | Programat (cada 6 h) + manual      | Audita tots els slugs de LV en paral·lel i després agrega |
| `cwv-audit-md.yml`     | Programat (cada 6 h) + manual      | Audita tots els slugs de MD en paral·lel i després agrega |
| `deploy-dashboard.yml` | Push a `main` sobre `dashboard/**` | Compila i desplega a GitHub Pages                         |

Els workflows d'auditoria generen un timestamp en zona horària de Madrid, construeixen una matriu de slugs a partir del fitxer de configuració d'URLs i executen cada slug com a job paral·lel. L'agregació s'executa un cop totes les auditories han acabat (fins i tot si alguna ha fallat).

## Scripts

| Script                         | Propòsit                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `scripts/run-audit.js`         | Orquestrador — executa Lighthouse 3 vegades, calcula la mediana de les mètriques i puja el resultat |
| `scripts/accept-cookies.js`    | Detecta i fa clic als botons de consentiment; desa les cookies a `/tmp/consent-cookies-{slug}.json` |
| `scripts/extract-cwv.js`       | Analitza LHR JSON → mètriques estructurades (LCP, CLS, FCP, TBT, TTFB, subfases de LCP)             |
| `scripts/upload-r2.js`         | Pujada R2 compatible amb S3 (`uploadReport`, `uploadDashboardData`)                                 |
| `scripts/aggregate-metrics.js` | Escaneja tots els objectes de R2, agrupa per slug, escriu `dashboard-data-{site}.json`              |

## Components del tauler

| Component               | Descripció                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `App.tsx`               | Obté les dades del tauler, gestiona l'estat de selecció de mètriques                                               |
| `MetricChart.tsx`       | Gràfic de línies amb bandes de llindar de Web Vitals (verd/groc/vermell) i enllaços als informes de Lighthouse     |
| `types.ts`              | Tipus `MetricKey`, `RunMetrics`, `DashboardData` i valors de llindar                                               |

## Relacionat

- `ggc-reports-ci` — repositori complementari per a auditories gestionades per Unlighthouse via crawler per dominis complets (mateix workspace, `reports-ws.code-workspace`)
