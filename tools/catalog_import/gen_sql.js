'use strict';

const fs   = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'catalog_normalized.json'), 'utf8'));

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  // U+0027 straight apostrophe + U+2019 curly right apostrophe (from Excel)
  const sqlEscape = s => String(s).replace(/['’]/g, "''");
  if (typeof v === 'object') return `'${sqlEscape(JSON.stringify(v))}'::jsonb`;
  return `'${sqlEscape(v)}'`;
}

const BATCH = 20;
const batches = [];

for (let i = 0; i < data.length; i += BATCH) {
  const slice = data.slice(i, i + BATCH);
  const values = slice.map(r => `(${[
    esc(r.sheet_source),
    esc(r.region),
    esc(r.location),
    esc(r.service_type),
    esc(r.service_name),
    esc(r.description_courte),
    esc(r.product_code),
    esc(r.rate_names),
    esc(r.season_start),
    esc(r.season_end),
    esc(r.prix_vente),
    esc(r.conditions_annulation_vente),
    esc(r.supplements_vente),
    esc(r.prix_achat),
    esc(r.conditions_annulation_achat),
    esc(r.supplements_achat),
    esc(r.buy_per_pax_extra),
    esc(r.prestataire_nom),
    esc(r.prestataire_email),
    esc(r.prestataire_tel),
    esc(r.mode_paiement),
    esc(r.prestataire_code),
    esc(r.prestataire_nom_2),
    esc(r.prestataire_email_2),
    esc(r.prestataire_tel_2),
    esc(r.notes),
    esc(r.tmt_link),
    esc(r.acces_plateforme),
  ].join(',')})`).join(',\n');

  const sql = `INSERT INTO public.rob_providers_catalog
  (sheet_source,region,location,service_type,service_name,description_courte,product_code,rate_names,season_start,season_end,prix_vente,conditions_annulation_vente,supplements_vente,prix_achat,conditions_annulation_achat,supplements_achat,buy_per_pax_extra,prestataire_nom,prestataire_email,prestataire_tel,mode_paiement,prestataire_code,prestataire_nom_2,prestataire_email_2,prestataire_tel_2,notes,tmt_link,acces_plateforme)
VALUES\n${values};`;

  batches.push(sql);
}

// Write each batch to a separate file
batches.forEach((sql, i) => {
  fs.writeFileSync(path.resolve(__dirname, `batch_${String(i).padStart(2,'0')}.sql`), sql, 'utf8');
});

console.log(`${batches.length} fichiers SQL générés (${data.length} lignes total, ${BATCH}/batch)`);
