#!/usr/bin/env node
/**
 * Orquestador del pipeline de auditoría CWV para una URL concreta.
 *
 * Uso: node scripts/run-audit.js --slug <slug> --timestamp <YYYY-MM-DD_HHmmss>
 *
 * Flujo:
 *  1. Acepta cookies (accept-cookies.js) → /tmp/consent-cookies-{slug}.json
 *  2. Lanza Puppeteer e inyecta cookies + localStorage (patrón idéntico al
 *     hook puppeteer:before-goto de ggc-reports-ci)
 *  3. Corre Lighthouse vía startFlow sobre el mismo page de Puppeteer
 *  4. Extrae métricas CWV del LHR
 *  5. Sube metrics.json + report.html a R2
 */

import puppeteer from 'puppeteer';
import { startFlow, generateReport } from 'lighthouse';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import { extractCwv } from './extract-cwv.js';
import { uploadReport } from './upload-r2.js';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- args ----------
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
};

const slug = getArg('slug');
const timestamp = getArg('timestamp');

if (!slug || !timestamp) {
  console.error('Uso: node scripts/run-audit.js --slug <slug> --timestamp <YYYY-MM-DD_HHmmss>');
  process.exit(1);
}

// ---------- cargar config de URL ----------
const urlsPath = path.join(__dirname, '..', 'configs', 'urls.json');
const urls = JSON.parse(fs.readFileSync(urlsPath, 'utf-8'));
const entry = urls.find((u) => u.slug === slug);

if (!entry) {
  console.error(`No se encontró la URL con slug "${slug}" en configs/urls.json`);
  process.exit(1);
}

const { url, label } = entry;
console.log(`\n▶ Auditando: ${label} (${url})`);
console.log(`  Timestamp: ${timestamp}\n`);

// ---------- aceptar cookies ----------
async function runAcceptCookies() {
  const scriptPath = path.join(__dirname, 'accept-cookies.js');
  console.log('🍪 Aceptando cookies...');
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [scriptPath, url, slug],
      { timeout: 60_000 },
    );
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  } catch (err) {
    console.warn('⚠️  accept-cookies.js falló:', err.message);
    // Continuar igualmente — puede que no haya banner de consentimiento
  }
}

// ---------- cargar y normalizar cookies ----------
function loadCookies() {
  const cookiePath = path.join(os.tmpdir(), `consent-cookies-${slug}.json`);
  if (!fs.existsSync(cookiePath)) return [];

  const raw = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
  const VALID_SAME_SITE = ['Strict', 'Lax', 'None'];
  return raw.map((c) => ({
    ...c,
    sameSite: VALID_SAME_SITE.includes(c.sameSite)
      ? c.sameSite
      : c.secure
        ? 'None'
        : 'Lax',
  }));
}

// ---------- pipeline principal ----------
async function main() {
  await runAcceptCookies();

  const cookies = loadCookies();
  const didomiCookie = cookies.find((c) => c.name === 'didomi_token');
  const euCookie     = cookies.find((c) => c.name === 'euconsent-v2');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Inyectar cookies (mismo patrón que hooks del proyecto hermano)
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
      console.log(`🍪 ${cookies.length} cookies inyectadas`);
    }

    // Inyectar localStorage para Didomi antes de cada nueva navegación
    if (didomiCookie || euCookie) {
      await page.evaluateOnNewDocument(
        (didomiVal, euVal) => {
          try {
            if (didomiVal) localStorage.setItem('didomi_token', didomiVal);
            if (euVal)     localStorage.setItem('euconsent-v2', euVal);
          } catch {}
        },
        didomiCookie?.value ?? null,
        euCookie?.value ?? null,
      );
    }

    // startFlow usa el page de Puppeteer → hereda cookies y scripts de evaluateOnNewDocument
    console.log('🔦 Lanzando Lighthouse...');
    const flow = await startFlow(page, {
      config: {
        settings: {
          formFactor: 'mobile',
          screenEmulation: {
            mobile: true,
            width: 375,
            height: 812,
            deviceScaleFactor: 3,
          },
          throttlingMethod: 'simulate',
          onlyCategories: ['performance'],
          disableStorageReset: true,
          maxWaitForLoad: 90_000,
        },
      },
    });

    await flow.navigate(url, { stepName: slug });

    const flowResult = await flow.createFlowResult();
    const lhr = flowResult.steps[0].lhr;

    const htmlReport = /** @type {string} */ (generateReport(lhr, 'html'));
    const metrics = extractCwv(lhr, { slug, url, label, timestamp });

    console.log(`\n📊 Métricas extraídas:`);
    console.log(`   Performance: ${metrics.performanceScore}`);
    console.log(`   LCP: ${metrics.lcp?.displayValue ?? 'N/A'}`);
    console.log(`   CLS: ${metrics.cls?.displayValue ?? 'N/A'}`);
    console.log(`   FCP: ${metrics.fcp?.displayValue ?? 'N/A'}`);
    console.log(`   TBT: ${metrics.tbt?.displayValue ?? 'N/A'}`);
    if (metrics.lcp?.phases) {
      const p = metrics.lcp.phases;
      console.log(`   LCP phases → TTFB: ${p.ttfb}ms · LoadDelay: ${p.loadDelay}ms · LoadDuration: ${p.loadDuration}ms · RenderDelay: ${p.renderDelay}ms`);
    }

    console.log('\n☁️  Subiendo a R2...');
    await uploadReport(slug, timestamp, JSON.stringify(metrics, null, 2), htmlReport);
    console.log('✅ Auditoría completada\n');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('❌ Error en run-audit.js:', err);
  process.exit(1);
});
