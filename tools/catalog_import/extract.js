/**
 * Catalogue prestataires Liberty FIT 2026
 * Script d'extraction et normalisation depuis le fichier Excel source
 *
 * Usage: node extract.js
 * Produit: catalog_normalized.json + validation_report.txt
 *
 * Nécessite: Node.js >= 18 + npm install (xlsx)
 * Note: écrit en Node.js car Python n'est pas installé sur la machine de travail.
 */

'use strict';

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

// ─── Fichier source (jamais modifié) ─────────────────────────────────────────
const SRC = path.resolve(
  __dirname,
  '../../TEMPLATE ACHAT VENTE SERVICES KT 2026_NE PAS TOUCHER.xlsx'
);

// ─── Mapping onglet → région / localisations ─────────────────────────────────
const SHEET_META = {
  'OK All France M&G':            { region: 'Meet & Greet',          locations: ['Paris', 'Bordeaux', 'Lyon'] },
  'OK Paris Private':             { region: 'Paris',                 locations: ['Paris'] },
  'OK Paris Activities & Shared ': { region: 'Paris',                locations: ['Paris'] },
  'OK Alsace':                    { region: 'Alsace',                locations: ['Colmar', 'Strasbourg', 'Breisach', 'Kehl'] },
  'Aquitaine':                    { region: 'Aquitaine',             locations: ['Bordeaux', 'Sarlat', 'Blaye', 'Bourg', 'Cadillac'] },
  'Rhone Alps':                   { region: 'Rhône-Alpes',           locations: ['Lyon', 'Vienne', 'Annecy', 'Chamonix', 'Viviers', 'Tournon'] },
  'OK Burgundy':                  { region: 'Bourgogne',             locations: ['Beaune', 'Dijon', 'Chalon sur Saône'] },
  'OK Champagne':                 { region: 'Champagne',             locations: ['Reims'] },
  'OK Loire Valley':              { region: 'Loire',                 locations: ['Amboise', 'Chambord', 'Cheverny', 'Cussac-Fort-Médoc', 'Mâcon', 'Tournus', 'Tours'] },
  'OK Normandy':                  { region: 'Normandie',             locations: ['Audrieu', 'Bayeux', 'Caen', 'Deauville', 'Honfleur', 'Cabourg', 'Port en Bessin'] },
  'OK Provence':                  { region: 'Provence',              locations: ['Aix en Provence', 'Avignon', 'Marseille', 'Arles', 'Viviers'] },
  'OK Roussillon':                { region: 'Roussillon',            locations: ['Lourdes', 'Toulouse'] },
  'OK South':                     { region: 'Sud',                   locations: ['Nice', 'Cannes', 'Libourne', 'Tournon'] },
  'Brittany':                     { region: 'Bretagne',              locations: ['Dinard', 'Saint-Malo'] },
  'OK Monaco':                    { region: 'Monaco & Saint-Tropez', locations: ['Monaco', 'Saint-Tropez'] },
  'Transfers Rest of France':     { region: 'Transferts France',     locations: [] },
  'OK Transfers Paris':           { region: 'Transferts Paris',      locations: ['Paris'] },
  'Shorex':                       { region: 'Excursions croisière',  locations: [] },
};

// ─── Table localisation → région (pour rob_region_locations) ─────────────────
const REGION_LOCATIONS = [
  { location: 'Paris',              region: 'Meet & Greet' },
  { location: 'Bordeaux',          region: 'Meet & Greet' },
  { location: 'Lyon',              region: 'Meet & Greet' },
  { location: 'Paris',             region: 'Paris' },
  { location: 'Colmar',            region: 'Alsace' },
  { location: 'Strasbourg',        region: 'Alsace' },
  { location: 'Breisach',          region: 'Alsace' },
  { location: 'Kehl',              region: 'Alsace' },
  { location: 'Bordeaux',          region: 'Aquitaine' },
  { location: 'Sarlat',            region: 'Aquitaine' },
  { location: 'Blaye',             region: 'Aquitaine' },
  { location: 'Bourg',             region: 'Aquitaine' },
  { location: 'Cadillac',          region: 'Aquitaine' },
  { location: 'Lyon',              region: 'Rhône-Alpes' },
  { location: 'Vienne',            region: 'Rhône-Alpes' },
  { location: 'Annecy',            region: 'Rhône-Alpes' },
  { location: 'Chamonix',          region: 'Rhône-Alpes' },
  { location: 'Viviers',           region: 'Rhône-Alpes' },
  { location: 'Tournon',           region: 'Rhône-Alpes' },
  { location: 'Beaune',            region: 'Bourgogne' },
  { location: 'Dijon',             region: 'Bourgogne' },
  { location: 'Chalon sur Saône',  region: 'Bourgogne' },
  { location: 'Reims',             region: 'Champagne' },
  { location: 'Amboise',           region: 'Loire' },
  { location: 'Chambord',          region: 'Loire' },
  { location: 'Cheverny',          region: 'Loire' },
  { location: 'Cussac-Fort-Médoc', region: 'Loire' },
  { location: 'Mâcon',             region: 'Loire' },
  { location: 'Tournus',           region: 'Loire' },
  { location: 'Tours',             region: 'Loire' },
  { location: 'Audrieu',           region: 'Normandie' },
  { location: 'Bayeux',            region: 'Normandie' },
  { location: 'Caen',              region: 'Normandie' },
  { location: 'Deauville',         region: 'Normandie' },
  { location: 'Honfleur',          region: 'Normandie' },
  { location: 'Cabourg',           region: 'Normandie' },
  { location: 'Port en Bessin',    region: 'Normandie' },
  { location: 'Aix en Provence',   region: 'Provence' },
  { location: 'Avignon',           region: 'Provence' },
  { location: 'Marseille',         region: 'Provence' },
  { location: 'Arles',             region: 'Provence' },
  { location: 'Viviers',           region: 'Provence' },
  { location: 'Lourdes',           region: 'Roussillon' },
  { location: 'Toulouse',          region: 'Roussillon' },
  { location: 'Nice',              region: 'Sud' },
  { location: 'Cannes',            region: 'Sud' },
  { location: 'Libourne',          region: 'Sud' },
  { location: 'Tournon',           region: 'Sud' },
  { location: 'Dinard',            region: 'Bretagne' },
  { location: 'Saint-Malo',        region: 'Bretagne' },
  { location: 'Monaco',            region: 'Monaco & Saint-Tropez' },
  { location: 'Saint-Tropez',      region: 'Monaco & Saint-Tropez' },
];

// ─── Normalisation d'un en-tête pour matching ────────────────────────────────
function norm(s) {
  if (s === null || s === undefined) return '';
  return String(s).toLowerCase().replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Conversion date Excel serial → texte 'YYYY-MM-DD' ───────────────────────
function excelDate(val) {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  if (!isNaN(n) && n > 30000 && n < 60000) {
    try {
      return XLSX.SSF.format('yyyy-mm-dd', n);
    } catch (_) {}
  }
  return String(val).trim() || null;
}

// ─── Détecte si une row ressemble à la ligne de headers principale ────────────
function looksLikeHeaderRow(row) {
  const vals = (row || []).map(v => norm(v));
  const markers = ['type', 'location', 'service name', 'description', 'product code'];
  return markers.filter(m => vals.some(v => v === m)).length >= 2;
}

// ─── Trouve l'index 0-based de la ligne de header dans le tableau aoa ────────
function findHeaderRowIdx(aoa) {
  for (let i = 0; i < Math.min(5, aoa.length); i++) {
    if (looksLikeHeaderRow(aoa[i])) return i;
  }
  return 1;
}

// ─── Construit l'index (normalized header → first column index) ──────────────
function buildColIndex(headerRow) {
  const idx = {};
  (headerRow || []).forEach((h, c) => {
    const n = norm(h);
    if (n && idx[n] === undefined) idx[n] = c;
  });
  return idx;
}

// ─── Trouve la première colonne correspondant à un des patterns (substring) ──
function findCol(idx, patterns) {
  for (const p of patterns) {
    const needle = norm(p);
    // Correspondance exacte
    if (idx[needle] !== undefined) return idx[needle];
    // Correspondance partielle
    const found = Object.keys(idx).find(k => k.includes(needle));
    if (found !== undefined) return idx[found];
  }
  return -1;
}

// ─── Trouve la Nième occurrence d'un pattern (pour gérer doublons d'en-tête) ─
function findColNthOccurrence(headerRow, pattern, n) {
  const needle = norm(pattern);
  let count = 0;
  for (let c = 0; c < headerRow.length; c++) {
    if (norm(headerRow[c]).includes(needle)) {
      count++;
      if (count === n) return c;
    }
  }
  return -1;
}

// ─── Valeur de cellule nettoyée ───────────────────────────────────────────────
function cellVal(row, colIdx) {
  if (colIdx < 0 || colIdx >= (row || []).length) return null;
  const v = (row || [])[colIdx];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// ─── Résumé court d'une description (max 300 caractères) ─────────────────────
function shortDesc(desc) {
  if (!desc) return null;
  const s = String(desc).replace(/\s+/g, ' ').trim();
  return s.length <= 300 ? s : s.slice(0, 297) + '...';
}

// ─── Extraction principale d'un onglet ───────────────────────────────────────
function extractSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return { rows: [], warnings: [`Onglet introuvable: ${sheetName}`] };

  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const warnings = [];
  const headerRowIdx = findHeaderRowIdx(aoa);
  const headerRow    = aoa[headerRowIdx] || [];
  const idx          = buildColIndex(headerRow);
  const meta         = SHEET_META[sheetName] || { region: sheetName, locations: [] };

  // ── Colonnes de base (ordre variable entre onglets) ──────────────────────
  const cType       = findCol(idx, ['type']);
  const cLocation   = findCol(idx, ['location']);
  // "Destination Location" n'est pas la localisation principale
  const cSvcName    = findCol(idx, ['service name']);
  const cDesc       = findCol(idx, ['description']);
  const cProdCode   = findCol(idx, ['product code']);
  const cInclusions = findCol(idx, [
    'tour inclusions ( vendor notes)', 'inclusions (tmt vendor notes)',
    'product inclusions', 'inclusions', 'tour inclusions'
  ]);
  const cRateNames  = findCol(idx, ['ratenames', 'rate names', 'rate name']);
  const cSeasonStart = findCol(idx, ['start date', 'season start']);
  const cSeasonEnd   = findCol(idx, ['end date', 'season end']);
  const cSupplSell   = findCol(idx, ['supplements']);
  const cOpNotes     = findCol(idx, ['operational notes']);
  const cTmtLink     = findCol(idx, ['tmt link', 'tmt link']);

  // Ancre de séparation vente / achat
  const cCancelPmt = findCol(idx, [
    'cancellation/ payment terms', 'cancellation/payment terms',
    'cancellation payment terms'
  ]);

  // ── Colonnes buy side ────────────────────────────────────────────────────
  const cCancelPolicy = findCol(idx, ['cancellation policy']);
  const cBuySuppl     = findCol(idx, ['night, sunday or bank holidays']);

  // Supplier 1 — chercher des variantes
  const cSupplName1  = findCol(idx, ['supplier name 1', 'supplier name']);
  const cSupplEmail1 = findCol(idx, ['supplier email 1', 'supplier email']);
  const cSupplTel1   = findCol(idx, ['supplier tel 1', 'supplier tel']);
  const cPayment1    = findCol(idx, ['payment 1', 'payment']);
  const cSupplCode1  = findCol(idx, ['supplier code 1', 'supplier code']);

  // Supplier 2 — chercher des variantes
  const cSupplName2  = findCol(idx, ['supplier name 2']);
  const cSupplEmail2 = findCol(idx, ['supplier email 2']);
  // Pour Rhone Alps : "Supplier tel" apparaît 2x → chercher la 2e occurrence
  let cSupplTel2 = findCol(idx, ['supplier tel 2']);
  if (cSupplTel2 < 0 && cSupplName2 >= 0) {
    // Scan forward depuis cSupplName2 pour trouver un header "tel"
    for (let c = cSupplName2 + 1; c < headerRow.length; c++) {
      const h = norm(headerRow[c]);
      if (h.includes('tel') || h.includes('phone')) {
        cSupplTel2 = c;
        break;
      }
    }
  }
  const cPayment2    = findCol(idx, ['payment 2']);
  const cSupplCode2  = findCol(idx, ['supplier code 2']);
  // Correspondance exacte uniquement pour NOTES (évite de matcher "Operational Notes")
  const cNotes = idx['notes'] !== undefined ? idx['notes'] : -1;

  // Validation ancres
  if (cCancelPmt < 0)    warnings.push(`Ancre "Cancellation/Payment Terms" non trouvée`);
  if (cCancelPolicy < 0) warnings.push(`Ancre "Cancellation policy" non trouvée`);
  if (cSupplName1 < 0)   warnings.push(`Colonne "Supplier name" non trouvée`);

  // ── Bornes des blocs vente / achat ───────────────────────────────────────
  // Le bloc achat (Per-Person, Guide cost, N PAX...) est situé entre
  // l'ancre vente (cCancelPmt) et le bloc prestataire (cSupplName1).
  // "Cancellation policy" est lui-même dans le bloc achat, pas son début.
  const sellEnd  = cCancelPmt >= 0 ? cCancelPmt - 1 : headerRow.length - 1;
  const buyStart = cCancelPmt >= 0 ? cCancelPmt + 1 : 0;
  const buyEnd   = cSupplName1 >= 0 ? cSupplName1 - 1 : headerRow.length - 1;

  // Colonnes "extra" après NOTES (cas Transfers Rest of France C45-C49)
  const notesEnd     = cNotes >= 0 ? cNotes : buyEnd;
  const extraPaxCols = {}; // { "2 pax": colIdx, ... }
  for (let c = notesEnd + 1; c < headerRow.length; c++) {
    const h = norm(headerRow[c]);
    const mPax = h.match(/^(\d+)\s*pax$/i);
    if (mPax) extraPaxCols[`${mPax[1]} pax`] = c;
  }

  // ── Collecte des indices de colonnes capacité vente ───────────────────────
  const sellPaxCols   = {};
  const sellGuideCols = {};
  const sellAssistCols = {};
  for (let c = 0; c <= sellEnd; c++) {
    const h = norm(headerRow[c]);
    if (!h) continue;
    const mPax = h.match(/(\d+)\s*pax/i);
    if (mPax) { sellPaxCols[`${mPax[1]} pax`] = c; continue; }
    if (h.includes('per-person') || h.includes('per person') ||
        h.includes('adult per person') || h.includes('adult  pp') ||
        h.includes('adult - per person') || h.includes('adult pp') ||
        h === 'second class' || h === 'standard class' || h === 'business class') {
      sellPaxCols[h] = c;
    }
    if (h.includes('guide') && !h.includes('cost') && !h.includes('driver')) {
      sellGuideCols[h] = c;
    }
    // All France M&G : colonnes "assistant - X pax" et "assistant off hours"
    if (h.includes('assistant')) {
      sellAssistCols[h] = c;
    }
  }

  // ── Collecte des indices de colonnes capacité achat ───────────────────────
  const buyPaxCols   = {};
  const buyGuideCols = {};
  for (let c = buyStart; c <= buyEnd; c++) {
    const h = norm(headerRow[c]);
    if (!h) continue;
    const mPax = h.match(/^(\d+)\s*pax$/i);      // match exact "N PAX" (évite "capacity 2 pax")
    if (mPax) { buyPaxCols[`${mPax[1]} pax`] = c; continue; }
    if (h === 'per-person' || h === 'per person' ||
        h.includes('per-person ad') || h.includes('per person ad')) {
      buyPaxCols['per_person'] = c;
    }
    if (h.includes('per-person chd') || h.includes('per person chd')) {
      buyPaxCols['per_person_child'] = c;
    }
    if (h.includes('guide cost') || h === 'guide cost') {
      buyGuideCols[h] = c;
    }
  }

  // ── Parcours des lignes de données ────────────────────────────────────────
  const rows = [];

  for (let r = headerRowIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];

    // Ignorer lignes vides ou sans service name
    if (row.every(v => v === null || v === '' || v === undefined)) continue;
    const svcName = cellVal(row, cSvcName);
    if (!svcName) continue;

    // ── Valeur nettoyée (filtre null, undefined, chaîne vide, espace seul) ──
    const cv = (row, c) => {
      if (c < 0 || c >= (row || []).length) return null;
      const v = row[c];
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      return s === '' ? null : s;
    };

    // ── Prix vente ──────────────────────────────────────────────────────────
    const prixVente = {};
    for (const [key, c] of Object.entries(sellPaxCols)) {
      const v = cv(row, c); if (v !== null) prixVente[key] = v;
    }
    for (const [key, c] of Object.entries(sellGuideCols)) {
      const v = cv(row, c); if (v !== null) prixVente[key] = v;
    }
    for (const [key, c] of Object.entries(sellAssistCols)) {
      const v = cv(row, c); if (v !== null) prixVente[key] = v;
    }

    // ── Prix achat ──────────────────────────────────────────────────────────
    const prixAchat = {};
    for (const [key, c] of Object.entries(buyPaxCols)) {
      const v = cv(row, c); if (v !== null) prixAchat[key] = v;
    }
    for (const [key, c] of Object.entries(buyGuideCols)) {
      const v = cv(row, c); if (v !== null) prixAchat[key] = v;
    }

    // ── Colonnes extra (Transfers Rest of France C45-C49) ──────────────────
    const buyPerPaxExtra = {};
    for (const [key, c] of Object.entries(extraPaxCols)) {
      const v = cv(row, c); if (v !== null) buyPerPaxExtra[key] = v;
    }

    // ── Location : préférer la valeur de la colonne "Location" ─────────────
    const locationRaw = cellVal(row, cLocation);

    const rec = {
      sheet_source:                sheetName,
      region:                      meta.region,
      location:                    locationRaw,
      service_type:                cellVal(row, cType),
      service_name:                svcName,
      description_courte:          shortDesc(cellVal(row, cDesc)),
      product_code:                cellVal(row, cProdCode),
      rate_names:                  cellVal(row, cRateNames),
      season_start:                excelDate(row[cSeasonStart] ?? null),
      season_end:                  excelDate(row[cSeasonEnd] ?? null),
      prix_vente:                  Object.keys(prixVente).length ? prixVente : null,
      conditions_annulation_vente: cellVal(row, cCancelPmt),
      supplements_vente:           cellVal(row, cSupplSell),
      prix_achat:                  Object.keys(prixAchat).length ? prixAchat : null,
      conditions_annulation_achat: cellVal(row, cCancelPolicy),
      supplements_achat:           cellVal(row, cBuySuppl),
      buy_per_pax_extra:           Object.keys(buyPerPaxExtra).length ? buyPerPaxExtra : null,
      prestataire_nom:             cellVal(row, cSupplName1),
      prestataire_email:           cellVal(row, cSupplEmail1),
      prestataire_tel:             cellVal(row, cSupplTel1),
      mode_paiement:               cellVal(row, cPayment1),
      prestataire_code:            cellVal(row, cSupplCode1),
      prestataire_nom_2:           cellVal(row, cSupplName2),
      prestataire_email_2:         cellVal(row, cSupplEmail2),
      prestataire_tel_2:           cSupplTel2 >= 0 ? cellVal(row, cSupplTel2) : null,
      notes:                       cellVal(row, cNotes),
      tmt_link:                    cellVal(row, cTmtLink),
      imported_at:                 new Date().toISOString(),
    };

    rows.push(rec);
  }

  return {
    rows,
    warnings,
    headerRowIdx,
    sheetName,
    colMap: { cCancelPmt, cCancelPolicy, cSupplName1, cSupplName2, cSupplTel2 },
  };
}

// ─── Rapport de validation ────────────────────────────────────────────────────
function buildReport(allResults) {
  const lines = [];
  lines.push('=== RAPPORT DE VALIDATION — CATALOGUE PRESTATAIRES LIBERTY 2026 ===');
  lines.push(`Génération : ${new Date().toLocaleString('fr-FR')}\n`);

  let totalRows = 0, totalNoCode = 0, totalNoContact = 0, totalNoBuy = 0;

  for (const res of allResults) {
    const { rows, warnings, sheetName } = res;
    const noCode    = rows.filter(r => !r.product_code).length;
    const noContact = rows.filter(r => !r.prestataire_email && !r.prestataire_nom).length;
    const noBuy     = rows.filter(r => !r.prix_achat).length;
    totalRows      += rows.length;
    totalNoCode    += noCode;
    totalNoContact += noContact;
    totalNoBuy     += noBuy;

    lines.push(`--- ${sheetName} ---`);
    lines.push(`  Lignes extraites      : ${rows.length}`);
    lines.push(`  Sans product_code     : ${noCode}`);
    lines.push(`  Sans contact presta   : ${noContact}`);
    lines.push(`  Sans prix achat       : ${noBuy}`);

    if (warnings.length) {
      lines.push(`  AVERTISSEMENTS :`);
      warnings.forEach(w => lines.push(`    ! ${w}`));
    }

    const sample = rows.slice(0, 3);
    if (sample.length) {
      lines.push(`  Echantillon (jusqu'à 3 lignes) :`);
      sample.forEach((r, i) => {
        lines.push(`    [${i + 1}] ${r.service_name}`);
        lines.push(`        Code       : ${r.product_code || '(vide)'}`);
        lines.push(`        Location   : ${r.location || '(vide)'}`);
        lines.push(`        Prestataire: ${r.prestataire_nom || '(vide)'} | ${r.prestataire_email || '(vide)'}`);
        lines.push(`        Prix vente : ${JSON.stringify(r.prix_vente || {})}`);
        lines.push(`        Prix achat : ${JSON.stringify(r.prix_achat || {})}`);
        if (r.buy_per_pax_extra) {
          lines.push(`        Extra cols : ${JSON.stringify(r.buy_per_pax_extra)}`);
        }
      });
    }
    lines.push('');
  }

  lines.push('=== TOTAUX ===');
  lines.push(`Total lignes extraites    : ${totalRows}`);
  lines.push(`Total sans product_code   : ${totalNoCode}`);
  lines.push(`Total sans contact presta : ${totalNoContact}`);
  lines.push(`Total sans prix achat     : ${totalNoBuy}`);

  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(SRC)) {
    console.error('ERREUR : fichier source introuvable :\n  ' + SRC);
    process.exit(1);
  }
  console.log('Lecture du fichier source...');
  const wb = XLSX.readFile(SRC, { type: 'file', cellDates: false, raw: true });
  console.log(`Onglets disponibles : ${wb.SheetNames.join(', ')}\n`);

  const sheetsToProcess = Object.keys(SHEET_META);
  const allResults = [];
  const allRows    = [];

  for (const sheetName of sheetsToProcess) {
    if (!wb.SheetNames.includes(sheetName)) {
      console.warn(`AVERTISSEMENT : onglet absent — ${sheetName}`);
      allResults.push({ sheetName, rows: [], warnings: ['Onglet absent du fichier'] });
      continue;
    }
    process.stdout.write(`  Extraction : ${sheetName}... `);
    const result = extractSheet(wb, sheetName);
    result.sheetName = sheetName;
    allResults.push(result);
    allRows.push(...result.rows);
    console.log(`${result.rows.length} lignes, ${result.warnings.length} avert.`);
  }

  // Écriture JSON normalisé
  const outJson = path.resolve(__dirname, 'catalog_normalized.json');
  fs.writeFileSync(outJson, JSON.stringify(allRows, null, 2), 'utf8');
  console.log(`\nJSON normalisé  : ${outJson}`);
  console.log(`                  ${allRows.length} lignes au total`);

  // Rapport de validation
  const report = buildReport(allResults);
  const outReport = path.resolve(__dirname, 'validation_report.txt');
  fs.writeFileSync(outReport, report, 'utf8');
  console.log(`Rapport         : ${outReport}`);

  // Export table rob_region_locations
  const outLocations = path.resolve(__dirname, 'region_locations.json');
  fs.writeFileSync(outLocations, JSON.stringify(REGION_LOCATIONS, null, 2), 'utf8');
  console.log(`Localisations   : ${outLocations}`);

  // Afficher les avertissements en console
  const allWarnings = allResults.flatMap(r => r.warnings.map(w => `[${r.sheetName}] ${w}`));
  if (allWarnings.length) {
    console.log('\n=== AVERTISSEMENTS ===');
    allWarnings.forEach(w => console.warn('  ! ' + w));
  }

  console.log('\nFait. Vérifier validation_report.txt avant import Supabase.');
}

main();
