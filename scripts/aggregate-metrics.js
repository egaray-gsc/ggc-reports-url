#!/usr/bin/env node
/**
 * Lee todos los metrics.json del bucket R2, los agrupa por slug
 * y genera el dashboard-data correspondiente en la raíz del bucket.
 *
 * Uso: node scripts/aggregate-metrics.js --urls configs/urls-lv.json --output dashboard-data-lv.json
 */

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import { uploadDashboardData } from './upload-r2.js';

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BASE_PREFIX = 'reports-url/';
const METRICS_RE = /^reports-url\/[^/]+\/[^/]+\/metrics\.json$/;

// Parse CLI args
const args = process.argv.slice(2);
const urlsFile = args[args.indexOf('--urls') + 1] ?? 'configs/urls.json';
const outputFile = args[args.indexOf('--output') + 1] ?? 'dashboard-data.json';

const urlsConfig = JSON.parse(readFileSync(urlsFile, 'utf-8'));
const allowedSlugs = new Set(urlsConfig.map((u) => u.slug));

async function listAllMetricsKeys() {
  const keys = [];
  let continuationToken;

  do {
    const cmd = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET,
      Prefix: BASE_PREFIX,
      ContinuationToken: continuationToken,
    });
    const res = await client.send(cmd);

    for (const obj of res.Contents ?? []) {
      if (METRICS_RE.test(obj.Key)) {
        keys.push(obj.Key);
      }
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

async function readJson(key) {
  const res = await client.send(
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
  );
  const chunks = [];
  for await (const chunk of res.Body) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}

async function main() {
  console.log(`📋 Listando metrics.json en R2 (${urlsFile} → ${outputFile})...`);
  const keys = await listAllMetricsKeys();
  console.log(`  Encontrados ${keys.length} ficheros en total`);

  const bySlug = new Map();

  for (const key of keys) {
    try {
      const metrics = await readJson(key);
      const { slug, label, url } = metrics;

      if (!allowedSlugs.has(slug)) continue;

      if (!bySlug.has(slug)) {
        bySlug.set(slug, { slug, label, url, runs: [] });
      }
      bySlug.get(slug).runs.push(metrics);
    } catch (err) {
      console.warn(`⚠️  No se pudo leer ${key}: ${err.message}`);
    }
  }

  // Ordenar runs ascendente por timestamp dentro de cada URL
  for (const entry of bySlug.values()) {
    entry.runs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  const dashboardData = {
    generatedAt: new Date().toISOString(),
    urls: Array.from(bySlug.values()),
  };

  const json = JSON.stringify(dashboardData, null, 2);
  console.log(`\n☁️  Subiendo ${outputFile}...`);
  await uploadDashboardData(json, outputFile);

  console.log(
    `✅ ${outputFile} generado con ${bySlug.size} URLs y ${Array.from(bySlug.values()).reduce((s, u) => s + u.runs.length, 0)} runs en total`,
  );
}

main().catch((err) => {
  console.error('❌ Error en aggregate-metrics.js:', err);
  process.exit(1);
});
