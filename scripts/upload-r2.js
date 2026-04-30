import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function putObject(key, body, contentType, cacheControl) {
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
  console.log(`✅ Subido: ${key}`);
}

/**
 * Sube metrics.json y report.html para un slug + timestamp concreto.
 */
export async function uploadReport(slug, timestamp, metricsJson, reportHtml) {
  const prefix = `reports-url/${slug}/${timestamp}`;
  await Promise.all([
    putObject(
      `${prefix}/metrics.json`,
      metricsJson,
      'application/json',
      'public, max-age=31536000, immutable',
    ),
    putObject(
      `${prefix}/report.html`,
      reportHtml,
      'text/html; charset=utf-8',
      'public, max-age=31536000, immutable',
    ),
  ]);
}

/**
 * Sube el fichero dashboard-data.json en la raíz del bucket.
 */
export async function uploadDashboardData(json) {
  await putObject(
    'reports-url/dashboard-data.json',
    json,
    'application/json',
    'public, max-age=300',
  );
}
