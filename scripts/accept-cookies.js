#!/usr/bin/env node
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { URL } from 'url';

const SITE = process.argv[2];
const SLUG = process.argv[3];

if (!SITE || !SLUG) {
  console.error('Uso: node scripts/accept-cookies.js <url> <slug>');
  process.exit(1);
}

const OUTPUT = path.join(os.tmpdir(), `consent-cookies-${SLUG}.json`);

const CONSENT_SELECTORS = [
  '#didomi-notice-agree-button',
  '.mrf-button.accept',
  'button[onclick*="acceptConsentWall"]',
  '.pmConsentWall-button',
  'astro-island[props*="acceptAll"] button',
  '#onetrust-accept-btn-handler',
  '.fc-cta-consent',
  '[data-testid="GDPR-accept"]',
  'button.sp_choice_type_11',
  '#acceptAll',
  'button[id*="accept"], button[class*="accept-all"]',
];

async function tryAcceptConsent(page) {
  for (const selector of CONSENT_SELECTORS) {
    try {
      await page.waitForSelector(selector, { timeout: 5000, visible: true });
      const text = await page.$eval(selector, (el) => (el.textContent || '').trim());
      if (!/aceptar|accept|continuar/i.test(text)) continue;
      await page.click(selector);
      await new Promise((r) => setTimeout(r, 3000));
      console.log(`✅ Consentimiento aceptado (${selector})`);
      return true;
    } catch {
      // selector no encontrado, probar el siguiente
    }
  }
  return false;
}

async function tryAcceptConsentInFrames(page) {
  const frames = page.frames();
  for (const frame of frames) {
    for (const selector of CONSENT_SELECTORS) {
      try {
        const button = await frame.$(selector);
        if (button) {
          const text = await button.evaluate((el) => (el.textContent || '').trim());
          if (!/aceptar|accept|continuar/i.test(text)) continue;
          await button.click();
          await new Promise((r) => setTimeout(r, 3000));
          console.log(`✅ Consentimiento aceptado en iframe (${selector})`);
          return true;
        }
      } catch {
        // continuar
      }
    }
  }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  );
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 30000 });

  const accepted =
    (await tryAcceptConsent(page)) || (await tryAcceptConsentInFrames(page));
  if (!accepted) {
    console.log('⚠️  Banner de consentimiento no detectado');
  }

  const cookies = await page.cookies();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(cookies, null, 2));
  console.log(`✅ ${cookies.length} cookies guardadas en ${OUTPUT}`);

  await browser.close();
})();
