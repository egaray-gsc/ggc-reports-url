#!/usr/bin/env node
/**
 * Script temporal para testear conectividad con R2.
 * Uso: R2_ENDPOINT=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=... node scripts/test-r2.js
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const required = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('❌ Faltan variables de entorno:', missing.join(', '));
  process.exit(1);
}

const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;

console.log('\n🔧 Configuración:');
console.log(`   Endpoint : ${R2_ENDPOINT}`);
console.log(`   Bucket   : ${R2_BUCKET}`);
console.log(`   Key ID   : ${R2_ACCESS_KEY_ID.slice(0, 8)}...`);

const client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const TEST_KEY = 'reports-url/__r2-test.txt';
const TEST_BODY = `R2 test - ${new Date().toISOString()}`;

async function run() {
  // 1. LIST (todos)
  console.log('\n📋 1. Listando objetos del bucket (primeros 5)...');
  try {
    const res = await client.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, MaxKeys: 5 }));
    console.log(`✅ List OK — ${res.KeyCount ?? 0} objetos mostrados`);
    res.Contents?.forEach((o) => console.log(`   • ${o.Key}`));
  } catch (err) {
    console.error('❌ List FAILED:', err.message);
  }

  // 1b. LIST reports-url/
  console.log('\n📋 1b. Listando reports-url/ ...');
  try {
    const res = await client.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: 'reports-url/', MaxKeys: 20 }));
    console.log(`✅ List OK — ${res.KeyCount ?? 0} objetos en reports-url/`);
    res.Contents?.forEach((o) => console.log(`   • ${o.Key}`));
  } catch (err) {
    console.error('❌ List FAILED:', err.message);
  }

  // 2. PUT
  console.log('\n📤 2. Escribiendo objeto de prueba...');
  try {
    await client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: TEST_KEY,
      Body: TEST_BODY,
      ContentType: 'text/plain',
    }));
    console.log(`✅ Put OK — clave: ${TEST_KEY}`);
  } catch (err) {
    console.error('❌ Put FAILED:', err.message);
    return;
  }

  // 3. GET
  console.log('\n📥 3. Leyendo objeto de prueba...');
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: TEST_KEY }));
    const body = await res.Body.transformToString();
    console.log(`✅ Get OK — contenido: "${body}"`);
  } catch (err) {
    console.error('❌ Get FAILED:', err.message);
  }

  // 4. DELETE
  console.log('\n🗑️  4. Eliminando objeto de prueba...');
  try {
    await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: TEST_KEY }));
    console.log(`✅ Delete OK`);
  } catch (err) {
    console.error('❌ Delete FAILED:', err.message);
  }

  console.log('\n✅ Test completado\n');
}

run().catch((err) => {
  console.error('❌ Error inesperado:', err);
  process.exit(1);
});
