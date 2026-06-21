'use strict';
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('catalog_normalized.json', 'utf8'));

// Detect credential leakage: email field contains more than bare email(s)
// Signs: MDP:, mdp:, Plateforme, login URL, password, identifiant, mot de passe
const credRe = /MDP\s*:|mdp\s*:|Plateforme\s*:|password|identifiant|mot de passe|login|https?:\/\//i;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const suspects = [];
data.forEach((r, i) => {
  const f1 = String(r.prestataire_email   || '');
  const f2 = String(r.prestataire_email_2 || '');
  if (credRe.test(f1) || credRe.test(f2)) {
    suspects.push({
      idx: i,
      inDB: i < 260,
      batch: Math.floor(i / 20),
      product_code: r.product_code,
      prestataire_nom: r.prestataire_nom,
      prestataire_email: f1,
      prestataire_email_2: f2,
    });
  }
});

const inDB   = suspects.filter(r => r.inDB);
const notInDB = suspects.filter(r => !r.inDB);

console.log(`=== CREDENTIAL SCAN ===`);
console.log(`Total suspects: ${suspects.length}`);
console.log(`Already in DB (idx 0-259):  ${inDB.length}`);
console.log(`In TODO batches (idx 260+): ${notInDB.length}`);
console.log('');

suspects.forEach(r => {
  console.log(`idx ${r.idx} [${r.inDB?'DB':'TODO'}] batch_${String(r.batch).padStart(2,'0')} | ${r.product_code}`);
  console.log(`  prestataire_email  : ${r.prestataire_email.slice(0,200)}`);
  if (r.prestataire_email_2 && credRe.test(r.prestataire_email_2)) {
    console.log(`  prestataire_email_2: ${r.prestataire_email_2.slice(0,200)}`);
  }
});

// Extract clean email from a field
function extractEmails(field) {
  const matches = field.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
  return matches ? [...new Set(matches)].join(' / ') : '';
}
function extractCreds(field) {
  // Everything that is NOT the email part
  const emails = (field.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []);
  let rest = field;
  emails.forEach(e => { rest = rest.replace(e, ''); });
  return rest.replace(/^\s*[\/,;|]\s*|\s*[\/,;|]\s*$/g, '').trim();
}

console.log('\n=== PREVIEW SPLIT (first 5) ===');
suspects.slice(0,5).forEach(r => {
  const cleanEmail = extractEmails(r.prestataire_email);
  const creds      = extractCreds(r.prestataire_email);
  console.log(`idx ${r.idx}: ${r.product_code}`);
  console.log(`  email_clean : ${cleanEmail}`);
  console.log(`  acces_plat  : ${creds.slice(0,150)}`);
});
