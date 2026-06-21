'use strict';
const fs   = require('fs');
const path = require('path');

const fpath = path.resolve(__dirname, 'catalog_normalized.json');
let data = JSON.parse(fs.readFileSync(fpath, 'utf8'));

const credRe  = /MDP\s*:|mdp\s*:|Plateforme\s*:|password|identifiant|mot de passe|login|https?:\/\//i;
const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Extract only provider contact emails (not Liberty's own login)
function extractProviderEmails(field) {
  if (!field) return null;
  const matches = String(field).match(emailRe) || [];
  const provider = matches.filter(e =>
    !e.toLowerCase().includes('liberty-int.com') &&
    !e.toLowerCase().includes('liberty-int.co')
  );
  return provider.length ? [...new Set(provider)].join(' / ') : null;
}

// Extract the credential block from a field (everything from the first credential line onwards)
// Keeps Liberty login emails IN the creds (they're usernames, not provider contacts)
function extractCredBlock(field) {
  if (!field || !credRe.test(String(field))) return null;
  const lines = String(field).split(/\r?\n/);
  const credStart = lines.findIndex(l => credRe.test(l));
  if (credStart < 0) return null;
  return lines.slice(credStart).join(' ').replace(/\s{2,}/g, ' ').trim();
}

let fixed = 0;
let fixedDB = 0;
const changes = [];

data.forEach((r, i) => {
  const f1 = r.prestataire_email   != null ? String(r.prestataire_email)   : '';
  const f2 = r.prestataire_email_2 != null ? String(r.prestataire_email_2) : '';
  const hasCred1 = credRe.test(f1);
  const hasCred2 = credRe.test(f2);
  if (!hasCred1 && !hasCred2) return;

  const cred1 = hasCred1 ? extractCredBlock(f1) : null;
  const cred2 = hasCred2 ? extractCredBlock(f2) : null;
  const combinedCreds = [cred1, cred2].filter(Boolean).join(' | ') || null;

  r.prestataire_email   = hasCred1 ? extractProviderEmails(f1) : (r.prestataire_email   || null);
  r.prestataire_email_2 = hasCred2 ? extractProviderEmails(f2) : (r.prestataire_email_2 || null);
  r.acces_plateforme    = combinedCreds;

  fixed++;
  if (i < 260) fixedDB++;
  changes.push({ idx: i, inDB: i < 260 });
});

// Ensure acces_plateforme key exists on ALL rows (null for clean rows)
data.forEach(r => {
  if (!Object.prototype.hasOwnProperty.call(r, 'acces_plateforme')) {
    r.acces_plateforme = null;
  }
});

fs.writeFileSync(fpath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Fixed: ${fixed} rows (${fixedDB} in DB, ${fixed - fixedDB} in TODO batches)`);

// Spot-checks
const checks = [14, 29, 64, 66, 115, 231, 575, 597];
checks.forEach(i => {
  const r = data[i];
  console.log(`\nidx ${i} ${r.product_code}:`);
  console.log(`  prestataire_email   : ${r.prestataire_email}`);
  console.log(`  prestataire_email_2 : ${r.prestataire_email_2}`);
  console.log(`  acces_plateforme    : ${String(r.acces_plateforme || 'null').slice(0, 160)}`);
});

// Verify: no credentials remaining in email fields
let leakRemaining = 0;
data.forEach((r, i) => {
  for (const f of [r.prestataire_email, r.prestataire_email_2]) {
    if (f && credRe.test(String(f))) {
      console.log(`\nLEAK REMAINING idx ${i}: ${String(f).slice(0, 100)}`);
      leakRemaining++;
    }
  }
});
console.log(`\nCredential leak remaining in email fields: ${leakRemaining} ${leakRemaining === 0 ? '✓ CLEAN' : '← FIX NEEDED'}`);
