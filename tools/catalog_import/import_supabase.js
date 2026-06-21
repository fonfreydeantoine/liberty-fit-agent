/**
 * Import catalogue prestataires Liberty vers Supabase
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_KEY = "eyJ..."   (PowerShell)
 *   node import_supabase.js
 *
 * La service_role key se trouve dans :
 *   Dashboard Supabase → Settings → API → service_role (secret)
 *
 * NE JAMAIS utiliser la clé anon de index.html — elle est bloquée par RLS
 * sur rob_providers_catalog. Seule la service_role bypasse ce RLS.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://biknungxkdxtwhdhhxcm.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('ERREUR : variable SUPABASE_SERVICE_KEY non définie.');
  console.error('  PowerShell : $env:SUPABASE_SERVICE_KEY = "eyJ..."');
  process.exit(1);
}

const HEADERS = {
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey':        SERVICE_KEY,
  'Prefer':        'return=minimal',
};

// ─── Insertion par batch ──────────────────────────────────────────────────────
async function insertBatch(table, rows) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: HEADERS,
    body:    JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${table} HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
}

async function upsertBatch(table, rows) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { ...HEADERS, 'Prefer': 'return=minimal,resolution=merge-duplicates' },
    body:    JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${table} HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
}

// ─── Vide une table avant réimport ────────────────────────────────────────────
async function truncateTable(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=gt.0`;
  const res  = await fetch(url, { method: 'DELETE', headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Truncate ${table} HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const catalogFile   = path.resolve(__dirname, 'catalog_normalized.json');
  const locationsFile = path.resolve(__dirname, 'region_locations.json');

  if (!fs.existsSync(catalogFile)) {
    console.error('ERREUR : catalog_normalized.json introuvable. Lancer extract.js d\'abord.');
    process.exit(1);
  }

  const catalog   = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  const locations = JSON.parse(fs.readFileSync(locationsFile, 'utf8'));

  console.log(`Catalogue : ${catalog.length} lignes`);
  console.log(`Localisations : ${locations.length} entrées`);
  console.log('');

  // ── Import rob_providers_catalog ─────────────────────────────────────────
  console.log('Vidage de rob_providers_catalog...');
  await truncateTable('rob_providers_catalog');

  const BATCH = 50;
  let imported = 0;
  for (let i = 0; i < catalog.length; i += BATCH) {
    const batch = catalog.slice(i, i + BATCH);
    process.stdout.write(`  Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(catalog.length / BATCH)} (${imported}/${catalog.length})...\r`);
    await insertBatch('rob_providers_catalog', batch);
    imported += batch.length;
  }
  console.log(`\n  ${imported} lignes importées dans rob_providers_catalog`);

  // ── Import rob_region_locations ──────────────────────────────────────────
  console.log('Vidage de rob_region_locations...');
  await truncateTable('rob_region_locations');

  await insertBatch('rob_region_locations', locations);
  console.log(`  ${locations.length} entrées importées dans rob_region_locations`);

  console.log('\nImport terminé.');
}

main().catch(err => {
  console.error('\nERREUR fatale :', err.message);
  process.exit(1);
});
