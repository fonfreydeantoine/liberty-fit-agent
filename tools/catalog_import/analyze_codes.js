'use strict';
const fs   = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'catalog_normalized.json'), 'utf8'));

// ── helpers ─────────────────────────────────────────────────────────────────

const ALREADY_IN_DB = new Set(
  Array.from({length: 260}, (_, i) => i)   // rows 0-259 = batch_00-12
);

function inDB(idx) { return idx < 260; }

// ── Pass 1: suspicious raw codes ─────────────────────────────────────────────
// (/, =, *, embedded ", >1 consecutive space)
const suspectIdx = data.reduce((acc, r, i) => {
  const c = String(r.product_code || '');
  if (/[\/=\*"]/.test(c) || /  /.test(c)) acc.push(i);
  return acc;
}, []);

// ── Pass 2: duplicate codes ───────────────────────────────────────────────────
const codeMap = {};
data.forEach((r, i) => {
  const c = String(r.product_code || '').trim();
  if (!c) return;
  if (!codeMap[c]) codeMap[c] = [];
  codeMap[c].push(i);
});
const dupCodes = Object.entries(codeMap).filter(([, idxs]) => idxs.length > 1);

// ── Categorise suspect codes ──────────────────────────────────────────────────
const catA = []; // standard/luxury split (same service, price combo in one code)
const catB = []; // distinct combined services
const catC = []; // parasitic text on clean code
const catD = []; // other

suspectIdx.forEach(i => {
  const r    = data[i];
  const code = String(r.product_code || '');

  // (a) clearly /LUX or /LUXURY pattern in the code → standard+luxury combined
  if (/\s*\/\s*(.*LUX|.*LUXURY)/i.test(code)) {
    catA.push(i);
    return;
  }

  // (b) two distinct service codes joined by / or +
  // heuristic: both parts look like product codes (uppercase letters+digits, no spaces)
  const slashParts = code.split('/').map(p => p.trim());
  if (slashParts.length === 2 && slashParts.every(p => /^[A-Z0-9&]+$/.test(p))) {
    catB.push(i);
    return;
  }

  // (c) = sign (description glued to code) or * or trailing text after a clean code prefix
  if (/=/.test(code) || /\*/.test(code)) { catC.push(i); return; }

  // (c) also: code starts with clean code then space + quoted text
  if (/^[A-Z0-9]+\s+["\(]/.test(code)) { catC.push(i); return; }

  // (c) multiple spaces with text after clean prefix
  if (/^[A-Z0-9]+\s{2,}/.test(code)) { catC.push(i); return; }

  catD.push(i);
});

// ── Categorise duplicate codes ────────────────────────────────────────────────
// We separate: valid seasonal (same code, different season_start/end) vs genuine dup
const dupSeasonal   = []; // same code, different seasons (valid)
const dupSameTable  = []; // same code, same service, same seasons (possible true dup)
const dupDistinct   = []; // same code, clearly different services
const dupAlreadyDB  = []; // any of the above where ≥1 idx < 260

dupCodes.forEach(([code, idxs]) => {
  const rows = idxs.map(i => data[i]);
  // Are all seasons different?
  const seasons = rows.map(r => `${r.season_start}|${r.season_end}`);
  const uniqueSeasons = new Set(seasons);

  const anyDB = idxs.some(i => inDB(i));

  // check if service names differ
  const names = [...new Set(rows.map(r => String(r.service_name || '')))];

  if (uniqueSeasons.size === idxs.length) {
    // every row has a distinct season → valid seasonal pricing
    dupSeasonal.push({ code, idxs, anyDB });
  } else if (names.length > 1) {
    // seasons overlap but services differ → genuine distinct-service dup
    dupDistinct.push({ code, idxs, names, anyDB });
  } else {
    // same season, same name → possible true dup
    dupSameTable.push({ code, idxs, anyDB });
  }
});

// ── Count already-in-DB for suspect codes ────────────────────────────────────
const suspectInDB = suspectIdx.filter(i => inDB(i));
const dupDistinctInDB = dupDistinct.filter(d => d.anyDB);

// ── Output ────────────────────────────────────────────────────────────────────
console.log('=== ANALYSE ANOMALIES product_code ===\n');
console.log(`Total rows: ${data.length}`);
console.log(`Rows already in DB (idx 0-259): 260\n`);

console.log('─── CODES SUSPECTS (/, =, *, ", espaces multiples) ───');
console.log(`Total: ${suspectIdx.length} lignes`);
console.log(`  Dont déjà en DB: ${suspectInDB.length}`);
console.log(`  (a) Standard+Luxury combinés (→ scindable proprement): ${catA.length}`);
catA.forEach(i => {
  const r = data[i];
  console.log(`      idx ${i} [${inDB(i)?'DB':'TODO'}] ${r.product_code} | ${r.service_name}`);
});
console.log(`  (b) Services distincts combinés (→ décision manuelle): ${catB.length}`);
catB.forEach(i => {
  const r = data[i];
  console.log(`      idx ${i} [${inDB(i)?'DB':'TODO'}] ${r.product_code} | ${r.service_name}`);
});
console.log(`  (c) Texte parasite (extraction simple): ${catC.length}`);
catC.forEach(i => {
  const r = data[i];
  console.log(`      idx ${i} [${inDB(i)?'DB':'TODO'}] ${r.product_code}`);
});
console.log(`  (d) Autres: ${catD.length}`);
catD.forEach(i => {
  const r = data[i];
  console.log(`      idx ${i} [${inDB(i)?'DB':'TODO'}] ${r.product_code} | ${r.service_name}`);
});

console.log('\n─── DOUBLONS DE CODE ───');
console.log(`Codes apparaissant plus d'une fois: ${dupCodes.length}`);
console.log(`  Saisonniers (valides): ${dupSeasonal.length} codes`);
console.log(`  Services distincts même code (anomalie): ${dupDistinct.length} codes`);
dupDistinct.forEach(d => {
  const tag = d.anyDB ? '[≥1 en DB]' : '[TODO]';
  const idxStr = d.idxs.map(i => `${i}[${inDB(i)?'DB':'todo'}]`).join(', ');
  console.log(`    ${tag} ${d.code}: ${d.idxs.length} lignes — idx ${idxStr}`);
  d.names.forEach(n => console.log(`      service: "${n}"`));
});
console.log(`  Potentiels vrais doublons: ${dupSameTable.length} codes`);
dupSameTable.forEach(d => {
  const tag = d.anyDB ? '[≥1 en DB]' : '[TODO]';
  const idxStr = d.idxs.map(i => `${i}[${inDB(i)?'DB':'todo'}]`).join(', ');
  console.log(`    ${tag} ${d.code}: ${d.idxs.length} lignes — idx ${idxStr}`);
});

console.log('\n─── DETAIL CAT (b) — services distincts combinés ───');
catB.forEach(i => {
  const r = data[i];
  console.log(`\nidx ${i} [${inDB(i)?'DEJA EN DB':'TODO'}]`);
  console.log(`  product_code     : ${r.product_code}`);
  console.log(`  service_name     : ${r.service_name}`);
  console.log(`  description_courte: ${r.description_courte}`);
  console.log(`  sheet_source     : ${r.sheet_source}`);
  console.log(`  prix_vente       : ${JSON.stringify(r.prix_vente)}`);
  console.log(`  prix_achat       : ${JSON.stringify(r.prix_achat)}`);
});

console.log('\n─── DETAIL CAT (d) — autres ───');
catD.forEach(i => {
  const r = data[i];
  console.log(`\nidx ${i} [${inDB(i)?'DEJA EN DB':'TODO'}]`);
  console.log(`  product_code     : ${r.product_code}`);
  console.log(`  service_name     : ${r.service_name}`);
  console.log(`  sheet_source     : ${r.sheet_source}`);
});
