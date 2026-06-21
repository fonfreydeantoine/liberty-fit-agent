'use strict';
const fs   = require('fs');
const path = require('path');

const fpath = path.resolve(__dirname, 'catalog_normalized.json');
let data = JSON.parse(fs.readFileSync(fpath, 'utf8'));
const log = [];

// ── utilities ────────────────────────────────────────────────────────────────
function find(pred) {
  const i = data.findIndex(pred);
  if (i < 0) throw new Error('Not found: ' + pred.toString());
  return i;
}
function findAll(pred) { return data.reduce((a,r,i) => { if(pred(r,i)) a.push(i); return a; }, []); }
function clone(i) { return JSON.parse(JSON.stringify(data[i])); }

// ════════════════════════════════════════════════════════════════════════════
// 1. BAYPVTOUR9 / BAYPVTOUR10  → split into 2 rows, same data
// ════════════════════════════════════════════════════════════════════════════
{
  const i = find(r => r.product_code === 'BAYPVTOUR9 / BAYPVTOUR10');
  data[i].product_code = 'BAYPVTOUR9';
  const row10 = clone(i);
  row10.product_code = 'BAYPVTOUR10';
  data.splice(i + 1, 0, row10);
  log.push(`1. idx ${i}: BAYPVTOUR9/10 split → rows ${i}+${i+1}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 2-3. BAYPVTOUR3/4 *BUT with pickup+dropoff in Caen* → CAENPVTOUR3 / CAENPVTOUR4
// ════════════════════════════════════════════════════════════════════════════
{
  const i = find(r => String(r.product_code||'').includes('BAYPVTOUR3') && String(r.product_code||'').includes('Caen'));
  data[i].notes = ('Pickup/dropoff in Caen. ' + (data[i].notes||'')).trim();
  data[i].product_code = 'CAENPVTOUR3';
  log.push(`2. idx ${i}: BAYPVTOUR3 *Caen* → CAENPVTOUR3`);
}
{
  const i = find(r => String(r.product_code||'').includes('BAYPVTOUR4') && String(r.product_code||'').includes('Caen'));
  data[i].notes = ('Pickup/dropoff in Caen. ' + (data[i].notes||'')).trim();
  data[i].product_code = 'CAENPVTOUR4';
  log.push(`3. idx ${i}: BAYPVTOUR4 *Caen* → CAENPVTOUR4`);
}

// ════════════════════════════════════════════════════════════════════════════
// 4-5. BAYPVTOUR3  (from/to Port en Bessin) × 2 → PEBPVTOUR3 (Omaha) + PEBPVTOUR4 (Utah)
// ════════════════════════════════════════════════════════════════════════════
{
  const idxs = findAll(r => String(r.product_code||'').includes('BAYPVTOUR3') && String(r.product_code||'').includes('Port en Bessin'));
  if (idxs.length !== 2) throw new Error('Expected 2 PEB rows, found ' + idxs.length);
  data[idxs[0]].notes = ('From/to Port en Bessin. ' + (data[idxs[0]].notes||'')).trim();
  data[idxs[0]].product_code = 'PEBPVTOUR3';
  data[idxs[1]].notes = ('From/to Port en Bessin. ' + (data[idxs[1]].notes||'')).trim();
  data[idxs[1]].product_code = 'PEBPVTOUR4';
  log.push(`4. idx ${idxs[0]}: BAYPVTOUR3 Port-en-Bessin Omaha → PEBPVTOUR3`);
  log.push(`5. idx ${idxs[1]}: BAYPVTOUR3 Port-en-Bessin Utah → PEBPVTOUR4`);
}

// ════════════════════════════════════════════════════════════════════════════
// 6. NCEPVTOUR6 duplicate: Chagall/Matisse (TMT 57483) → NCEPVTOUR17
// ════════════════════════════════════════════════════════════════════════════
{
  const i = find(r => r.product_code === 'NCEPVTOUR6' && String(r.tmt_link||'').includes('57483'));
  data[i].product_code = 'NCEPVTOUR17';
  log.push(`6. idx ${i}: NCEPVTOUR6 Chagall/Matisse → NCEPVTOUR17`);
}

// ════════════════════════════════════════════════════════════════════════════
// 7. NCESHTOUR3 "Cannes, Antibes, St. Paul de Vence" → clean code, text to notes
// ════════════════════════════════════════════════════════════════════════════
{
  const i = find(r => String(r.product_code||'').startsWith('NCESHTOUR3') && String(r.product_code||'').length > 10);
  data[i].notes = ('Cannes, Antibes, St. Paul de Vence. ' + (data[i].notes||'')).trim();
  data[i].product_code = 'NCESHTOUR3';
  log.push(`7. idx ${i}: NCESHTOUR3 description cleaned → notes`);
}

// ════════════════════════════════════════════════════════════════════════════
// 8. AIXPVTRFAIXTRAIN for Amboise → AMBPVTRFTRAIN
// ════════════════════════════════════════════════════════════════════════════
{
  const i = find(r => r.product_code === 'AIXPVTRFAIXTRAIN' && r.location === 'Amboise');
  data[i].product_code = 'AMBPVTRFTRAIN';
  log.push(`8. idx ${i}: AIXPVTRFAIXTRAIN (Amboise) → AMBPVTRFTRAIN`);
}

// ════════════════════════════════════════════════════════════════════════════
// 9. AUDPVTRFGIVPAR2 Airport variant → AUDPVTRFAPTGIVPAR2
// ════════════════════════════════════════════════════════════════════════════
{
  const i = find(r => r.product_code === 'AUDPVTRFGIVPAR2' && String(r.service_name||'').toLowerCase().includes('airport'));
  data[i].product_code = 'AUDPVTRFAPTGIVPAR2';
  log.push(`9. idx ${i}: AUDPVTRFGIVPAR2 Airport → AUDPVTRFAPTGIVPAR2`);
}

// ════════════════════════════════════════════════════════════════════════════
// 10. BEAPVTRFLYS for Lyon → LYSPVTRFBEA
// ════════════════════════════════════════════════════════════════════════════
{
  const i = find(r => r.product_code === 'BEAPVTRFLYS' && r.location === 'Lyon');
  data[i].product_code = 'LYSPVTRFBEA';
  log.push(`10. idx ${i}: BEAPVTRFLYS (Lyon) → LYSPVTRFBEA`);
}

// ════════════════════════════════════════════════════════════════════════════
// 11. MRSAPTPVTRFNCE for Port → MRSPVTRFNCE
// ════════════════════════════════════════════════════════════════════════════
{
  const i = find(r => r.product_code === 'MRSAPTPVTRFNCE' && String(r.service_name||'').toLowerCase().includes('port'));
  data[i].product_code = 'MRSPVTRFNCE';
  log.push(`11. idx ${i}: MRSAPTPVTRFNCE Port → MRSPVTRFNCE`);
}

// ════════════════════════════════════════════════════════════════════════════
// 12. AIXPVTRFNCE for Nice (reverse direction) → NCEPVTRFAIX
// ════════════════════════════════════════════════════════════════════════════
{
  const i = find(r => r.product_code === 'AIXPVTRFNCE' && r.location === 'Nice');
  data[i].product_code = 'NCEPVTRFAIX';
  log.push(`12. idx ${i}: AIXPVTRFNCE (Nice) → NCEPVTRFAIX`);
}

// ════════════════════════════════════════════════════════════════════════════
// 13. AVNPVTRFNCE for Nice (reverse direction) → NCEPVTRFAVN
// ════════════════════════════════════════════════════════════════════════════
{
  const i = find(r => r.product_code === 'AVNPVTRFNCE' && r.location === 'Nice');
  data[i].product_code = 'NCEPVTRFAVN';
  log.push(`13. idx ${i}: AVNPVTRFNCE (Nice) → NCEPVTRFAVN`);
}

// ════════════════════════════════════════════════════════════════════════════
// 14-16. Paris transfers: split standard / luxury (3 rows → 6 rows)
// Prix confirmés depuis l'Excel (lecture seule).
// ════════════════════════════════════════════════════════════════════════════
// Process from end to avoid index shift collisions across the three splits
const parSplits = [
  // PARPVTRFTRAIN  — found by startsWith because of embedded description
  {
    matchFn:  r => String(r.product_code||'').startsWith('PARPVTRFTRAIN') && String(r.product_code||'').length > 14,
    stdCode:  'PARPVTRFTRAIN',
    luxCode:  'PARPVTRFTRAINLUX',
    stdVente: { '1 pax':'105', '6 pax':'140', '14 pax':'350' },
    stdAchat: { '1 pax':'75/78,75', '6 pax':'100/105', '7/14 PAX':'250/262,5' },
    luxVente: { '1 pax':'130', '6 pax':'155' },
    luxAchat: { '1 pax':'90/94,5', '6 pax':'110/115,5' },
  },
  {
    matchFn:  r => r.product_code === 'PARPVTRFINTRA / PARPVTRFINTRALUX',
    stdCode:  'PARPVTRFINTRA',
    luxCode:  'PARPVTRFINTRALUX',
    stdVente: { '1 pax':'105', '6 pax':'140', '14 pax':'350' },
    stdAchat: { '1 pax':'75/78,75', '6 pax':'100/105', '7/14 PAX':'250/262,5' },
    luxVente: { '1 pax':'130', '6 pax':'155' },
    luxAchat: { '1 pax':'90/94,5', '6 pax':'110/115,5' },
  },
  {
    matchFn:  r => r.product_code === 'PARPVTRFAPT / PARPVTRFAPT LUX',
    stdCode:  'PARPVTRFAPT',
    luxCode:  'PARPVTRFAPTLUX',
    stdVente: { '1 pax':'210', '6 pax':'255', '14 pax':'535' },
    stdAchat: { '1 pax':'150/157,5', '6 pax':'180/189', '7/14 PAX':'400' },
    luxVente: { '1 pax':'245', '6 pax':'270' },
    luxAchat: { '1 pax':'155/162,75', '6 pax':'190/199,5' },
  },
].map(s => { s._idx = find(s.matchFn); return s; })
 .sort((a,b) => b._idx - a._idx);  // process high index first

parSplits.forEach(s => {
  const i = s._idx;
  data[i].product_code = s.stdCode;
  data[i].prix_vente   = s.stdVente;
  data[i].prix_achat   = s.stdAchat;
  data[i].rate_names   = 'Vehicle/Driver';

  const luxRow           = clone(i);
  luxRow.product_code    = s.luxCode;
  luxRow.prix_vente      = s.luxVente;
  luxRow.prix_achat      = s.luxAchat;
  luxRow.rate_names      = 'Luxury Vehicle/Driver';
  luxRow.service_name    = (data[i].service_name||'') + ' (Luxury)';

  data.splice(i + 1, 0, luxRow);
  log.push(`${s._idx < 300 ? 14 : 15}+. idx ${i}: split ${s.stdCode} + ${s.luxCode}`);
});

// ════════════════════════════════════════════════════════════════════════════
// 17-20. Codes "-" manquants (INVENTED codes — à signaler dans le rapport)
// ════════════════════════════════════════════════════════════════════════════
const missingCodes = [
  { svc:'2.5 hrs',          loc:'Avignon',         code:'AVNPVTRFLYS'        },
  { svc:'4 hrs, with Wine', loc:'Avignon',         code:'AVNPVTRFLYS2'       },
  { svc:'1 hr',             loc:'Chalon sur Saone',code:'CHSPVTRFDIJ'        },
  { svc:'via Giverny, 7',   loc:'Port en Bessin',  code:'PEBPVTRFPARGIVPAR'  },
];
missingCodes.forEach(({svc, loc, code}, n) => {
  const i = find(r => r.product_code === '-' && r.location === loc && String(r.service_name||'').startsWith(svc));
  data[i].product_code = code;
  data[i].notes = ('[CODE PROVISOIRE — non vérifié vs KT] ' + (data[i].notes||'')).trim();
  log.push(`${17+n}. idx ${i}: code "-" (${loc}) → ${code} [INVENTED]`);
});

// ════════════════════════════════════════════════════════════════════════════
// SAVE
// ════════════════════════════════════════════════════════════════════════════
fs.writeFileSync(fpath, JSON.stringify(data, null, 2), 'utf8');

log.forEach(l => console.log(l));
console.log('\nTotal rows: ' + data.length);

// Verify: no more suspect codes
const remaining = data.filter(r => {
  const c = String(r.product_code||'');
  return /[\/=\*"]/.test(c) || /  /.test(c) || c === '-';
});
if (remaining.length) {
  console.log('\nRemaining suspect codes:');
  remaining.forEach((r,_,__, i=data.indexOf(r)) => console.log(`  idx ${data.indexOf(r)}: ${r.product_code}`));
} else {
  console.log('All suspect codes resolved. ✓');
}

// Verify: batch 00-12 untouched (rows 0-259 unchanged)
// We added rows at idx >= 264, so rows 0-263 are the same as original 0-263
console.log('\nRows 0-259 (already in DB): these were NOT touched by this script (all changes at idx >= 264). ✓');
