# ROB - Agent IA · Liberty FIT

> Document de référence exhaustif généré à partir du code source, de l'historique de la conversation et du contexte projet complet.
> À fournir en entête de tout nouveau fil Claude, Claude Code, Cursor ou session agent pour reprendre le projet sans réexpliquer.
> **Version : ROB v2.2 · Dernière mise à jour : 21 juin 2026**

---

## Résumé rapide

Rob est l'assistant IA interne du pôle FIT de Liberty Incentives & Congresses France. C'est une interface web HTML single-file, sobre, haut de gamme, hébergée sur GitHub Pages. Elle automatise les tâches chronophages des chefs de projet FIT : parsing de TMT Kensington, génération de fiches de coordination, rédaction de mails prestataires, construction de programmes clients, envoi de factures comptabilité, communications internes équipe, et analyse des emails entrants (Alfred).

Depuis v2.2, Rob dispose d'un **catalogue prestataires** de 614 lignes en base Supabase (`rob_providers_catalog`), interrogé automatiquement par Make via une fonction RPC Postgres (`match_providers_catalog`) avant chaque appel Claude. Le résultat JSON est injecté dans les payloads Kensington et Quotes sous la clé `CATALOGUE`.

- **URL production** : `https://fonfreydeantoine.github.io/liberty-fit-agent/`
- **URL guide utilisateur** : `https://fonfreydeantoine.github.io/liberty-fit-agent/rob_guide_utilisateur.html`
- **Repo** : `fonfreydeantoine/liberty-fit-agent` (public, branche `main`)
- **Mainteneur unique** : Antoine Fonfreyde

---

## Objectif du projet

### Problème résolu

Les chefs de projet FIT passent 20 à 45 minutes par dossier sur des tâches structurées mais répétitives :
- Lire un TMT Kensington (fichier dense), extraire les services, rédiger un mail par prestataire
- Construire un programme client depuis un brief souvent vague ou incomplet
- Rédiger des demandes de disponibilité à la main
- Acheminer des factures au service comptabilité
- Rédiger et envoyer des communications internes (info prestataire, récap astreinte)
- Trier manuellement une boite mail chargée en début de journée

### Valeur apportée

- Réduction du temps de traitement d'un TMT Kensington de 30-45 min à < 1 min
- Fiche de coordination structurée + tous les mails prestataires en une génération
- Programme client premium rédigé en anglais depuis un brief brut
- Tarifs catalogue prestataires pré-remplis automatiquement dans les mails et programmes
- Zéro perte de contexte entre sessions grâce à l'historique persistant par utilisateur
- Standardisation de la qualité de rédaction sur toute l'équipe

### Vision long terme

Rob a vocation à être répliqué pour les pôles FIT des bureaux Liberty Espagne et Portugal, et à terme décliné en versions adaptées pour les pôles MICE et Leisure de Liberty France.

---

## Statut actuel

**Production · ROB v2.2**

### Ce qui fonctionne

- Agent Kensington : parsing TMT → fiche de coordination + mails prestataires + regroupement de mails
- Agent Quotes : brief → fiche interne + programme client + réponse client + checklist + email questions + Acte 2 (cotation finale)
- Mails dispo : génération locale + prévisualisation + éditeur riche inline + envoi via Make/Gmail
- Quotes DOCX : génération Word 100% locale (docx.js, aucun réseau)
- Compta : envoi facture PDF vers comptabilité via Make/Gmail
- Comms internes : info presta + récap astreinte, éditeur riche inline, envoi équipe FIT
- Alfred : analyse emails non lus, triage priorité 4 niveaux, drafts de réponse
- Authentification Supabase avec permissions granulaires par compte (7 clés)
- Polling permissions toutes les 30 secondes en session active
- Historique de session persistant (8 dossiers, localStorage + Supabase)
- Console admin (`admin.html`) : gestion comptes + journal connexions
- Guide utilisateur interactif bilingue FR/EN hébergé sur GitHub Pages
- **[v2.2 NOUVEAU]** Catalogue prestataires Liberty : 614 lignes en base Supabase (`rob_providers_catalog`)
- **[v2.2 NOUVEAU]** Fonction RPC `match_providers_catalog` : détection région + filtrage catalogue en un seul appel
- **[v2.2 NOUVEAU]** PROMPT_KENSINGTON.md et PROMPT_QUOTES.md mis à jour pour exploiter le CATALOGUE

### Ce qui manque / bloqué

- **[Make — à configurer]** Appel RPC `match_providers_catalog` à intégrer dans les scénarios Kensington et Quotes avant l'appel Claude (voir section Make ci-dessous)
- **[Make — à configurer]** Injection du résultat JSON sous la clé `CATALOGUE` dans le payload Claude
- **[Acte 2 — hors scope]** Auto-déclenchement de la cotation finale quand le catalogue couvre tous les prix : bloqué par la garde `if (!tarifs)` dans `runCotation()` (index.html ligne 1764) — nécessiterait une modification de index.html, déclarée hors périmètre du chantier catalogue
- Envoi de mails depuis les adresses @liberty-int.com (bloqué : autorisation IT Tomasz via Azure AD)
- Alfred sur boite Outlook @liberty-int.com (même blocage IT)
- Recap matinal automatique des dossiers reçus hors heures ouvrées (fonctionnalité Alfred étendue, dépend Outlook)
- Templates personnalisés par utilisateur (style de rédaction adaptatif)
- Import TMT direct depuis Kensington via référence dossier
- Connexion calendrier Outlook

---

## CATALOGUE PRESTATAIRES LIBERTY — Documentation complète

> ⚠️ **ÉTAT AU 21/06/2026 — PAS ENCORE ACTIF EN PRODUCTION**
> Le catalogue est importé (614 lignes en base Supabase) et la fonction RPC `match_providers_catalog` fonctionne et est sécurisée. Mais le catalogue **n'est pas encore utilisé par Rob en production**. Deux gestes manuels restent dus à Antoine :
> 1. **Coller `PROMPT_KENSINGTON.md` et `PROMPT_QUOTES.md`** dans leurs pages Notion respectives (les fichiers locaux sont les miroirs de travail — Notion est la source lue par Make).
> 2. **Configurer l'appel RPC** `match_providers_catalog` dans les scénarios Make Kensington et Quotes (un module HTTP POST avant l'appel Claude, résultat injecté sous la clé `CATALOGUE`).
>
> Tant que ces deux actions ne sont pas faites, Rob se comporte comme avant v2.2 : pas de pré-remplissage tarifs, pas de mention `[DISPONIBLE EN CATALOGUE LIBERTY]`.

Cette section documente le chantier v2.2 terminé le 21/06/2026.

### Vue d'ensemble

Le catalogue est la base de données des tarifs et contacts prestataires Liberty, stockée en Supabase. Il contient 614 lignes couvrant les services France (excursions, transferts, hôtels, activités). Il est interrogé automatiquement par Make avant chaque appel Claude, filtré par région détectée dans le texte du brief/TMT, et injecté sous la clé `CATALOGUE` dans le payload Claude.

### Source de données

- **Fichier Excel source** (lecture seule) : `TEMPLATE ACHAT VENTE SERVICES KT 2026_NE PAS TOUCHER.xlsx`
  - Chemin : `C:\Users\AntoineFonfreydelLib\OneDrive - LITG\Documents\Projets\Rob\`
  - **Ne jamais modifier ce fichier**
- **JSON normalisé** : `tools/catalog_import/catalog_normalized.json` — source de vérité pour les données importées
- **Scripts d'import** : `tools/catalog_import/` (batch_00.sql à batch_30.sql, gen_sql.js) — peuvent être archivés/supprimés maintenant que l'import est terminé

### Import — état final

- **614 lignes en base** — COUNT vérifié post-import
- **Spot-check validé** : 18 lignes vérifiées sur 6 onglets différents (dont Normandy, Transfers Rest of France, OK Paris Activities & Shared, Sud, Alsace, Rhône-Alpes) — tous les tarifs et coordonnées prestataires correspondent à l'Excel source
- **4 lignes supplémentaires** par rapport au JSON source : splits Standard/Luxury pour PARPVTRFAPT, PARPVTRFINTRA, PARPVTRFTRAIN + dédoublement BAYPVTOUR9/10

### Doublons product_code — inventaire complet

**12 doublons intentionnels** (codes saisonniers ou multi-prestataires, jusqu'à 5 lignes par code) :

| product_code | Motif |
|---|---|
| AUDPVTRFBAYTRAIN | Saisonnier / multi-ligne |
| BAYPVPORT | Saisonnier / multi-ligne |
| BAYPVTRFBAYTRAIN | Saisonnier / multi-ligne |
| BAYPVTRFCAEN | Saisonnier / multi-ligne |
| BAYTRAINPVTRFAUD | Saisonnier / multi-ligne |
| CFRPVPEB | Saisonnier / multi-ligne |
| CFRPVTRFBAY | Saisonnier / multi-ligne |
| DEAPVTRFBAY | Saisonnier / multi-ligne |
| DEAPVTRFC | Saisonnier / multi-ligne |
| DEAPVTRFDEATRAIN | Saisonnier / multi-ligne |
| DEAPVTRFHON | Saisonnier / multi-ligne |
| PEBPVTRFBAYTRAIN | Saisonnier / multi-ligne |

**2 doublons inattendus corrigés le 21/06/2026** (pre-existaient dans le JSON source) :

| Situation initiale | Correction appliquée |
|---|---|
| `BAYPVTRFPARAPT2` partagé par deux transferts distincts (via Giverny id 427 / via Rouen id 428) | id 427 → garde `BAYPVTRFPARAPT2` (via Giverny, saison Apr–Nov 2025) ; id 428 → `BAYPVTRFPARAPT3` (via Rouen, année entière) |
| `MRSPVTRFNCE` partagé par Airport (id 523), Port (id 524) et City (id 525) | id 523 Airport → `MRSAPTPVTRFNCE` ; id 524 Port → `MRSPORTPVTRFNCE` ; id 525 City → garde `MRSPVTRFNCE` |

### Codes product_code provisoires (non vérifiés vs Kensington Tours)

Ces codes ont été inventés faute de code KT connu dans l'Excel. Le matching automatique par `product_code` (côté Kensington) ne fonctionnera pas tant que les vrais codes KT ne sont pas identifiés et mis à jour en base :

| product_code | Service | Raison |
|---|---|---|
| PARMRBELLEEP1 | Moulin Rouge Belle Époque Ven-Sam | Code KT inconnu |
| PARMRBELLEEP2 | Moulin Rouge Belle Époque Lun-Dim | Code KT inconnu |
| PARMRTOULLAU1 | Moulin Rouge Toulouse Lautrec Ven-Sam | Code KT inconnu |
| PARMRTOULLAU2 | Moulin Rouge Toulouse Lautrec Lun-Dim | Code KT inconnu |
| AVNPVTRFLYS | Transfer Avignon → Lyon (2.5 hrs) | Code KT absent de l'Excel |
| AVNPVTRFLYS2 | Transfer Avignon → Lyon via winery | Code KT absent de l'Excel |
| CHSPVTRFDIJ | Transfer Chalon-sur-Saône → Dijon | Code KT absent de l'Excel |
| PEBPVTRFPARGIVPAR | Transfer Port-en-Bessin → Paris via Giverny | Code KT absent de l'Excel |
| STPSHTFLIGHT | Panoramic Flight, Saint-Tropez (Shorex) | Code KT absent de l'Excel |
| STPSHTWINE | Wine Tour Bellet, Saint-Tropez (Shorex) | Code KT absent de l'Excel |
| HONSHTTOUR | Coastal Towns of Normandy, Honfleur (Shorex) | Code KT absent de l'Excel |

### Anomalies mineures en base (non bloquantes, connues)

| Code | Anomalie | Décision |
|---|---|---|
| batch_20 BAYPVTRFBAYTRAIN dernière variante | `service_type = '65'` (erreur Excel) | Laissé verbatim, non bloquant |
| `DIJPV TRFCHASAO` | Espace dans le product_code | Laissé verbatim |
| ids 94-97 | Codes Moulin Rouge contenant `*includes* PARPVCAR&DRIVER5` | UPDATE à faire manuellement si matching KT requis |
| ids 102-103 | PARPVDICR4 / PARPVDICR5 sans suffixe VIP | UPDATE si distinction requise |
| id 256 | AUDPVTOUR1 sans suffixe AM | UPDATE si distinction requise |
| ids 105, 248 | product_code NULL | Codes à définir manuellement |
| ids 496-497 | HONPVTRF5/6 : prix_achat=NULL, notes='DONNEES ACHAT A VERIFIER MANUELLEMENT' | Vérification manuelle requise |

### Intégration Make — ce qu'il reste à configurer

**Un seul module à ajouter** dans chaque scénario Kensington et Quotes, **avant** l'appel Claude :

**Endpoint :**
```
POST https://biknungxkdxtwhdhhxcm.supabase.co/rest/v1/rpc/match_providers_catalog
```

**Headers :**
```
apikey:        [SERVICE_ROLE_KEY — variable d'env Make]
Authorization: Bearer [SERVICE_ROLE_KEY]
Content-Type:  application/json
```

**Body :**
```json
{"input_text": "{{texte_brut_du_brief_ou_tmt}}"}
```

**Résultat :** tableau JSON → à injecter dans le payload Claude sous la clé `CATALOGUE`.

Si aucune localisation française connue dans le texte → retourne `[]` → CATALOGUE absent → les prompts se comportent comme avant (comportement de fallback).

**Référence complète :** `tools/catalog_import/NOTICE_MAKE.md`

### Fonction Postgres `match_providers_catalog`

Créée et déployée le 21/06/2026. Encapsule toute la logique de détection région + filtrage catalogue.

```sql
-- Signature
match_providers_catalog(input_text text) RETURNS json

-- Logique
-- 1. Cherche dans rob_region_locations les locations présentes dans input_text (ILIKE)
-- 2. Déduit les régions correspondantes (une location peut appartenir à une seule région)
-- 3. Retourne COALESCE(json_agg(row_to_json(c)), '[]'::json)
--    depuis rob_providers_catalog_safe pour ces régions
-- 4. Retourne [] si aucune correspondance — jamais d'erreur

-- Permissions (confirmées par test HTTP live le 21/06/2026)
-- EXECUTE : postgres (owner), service_role uniquement
-- Révoqué de : PUBLIC, anon, authenticated
-- Preuve : appel avec clé anon → HTTP 401, code Postgres 42501 "permission denied for function"
```

**Sécurité :** `SECURITY INVOKER` — s'exécute avec les droits du rôle appelant. service_role bypasse le RLS, anon est révoqué → aucun risque d'accès non autorisé.

### Comment les prompts exploitent le CATALOGUE

**PROMPT_KENSINGTON.md — comportement si CATALOGUE présent :**
- Matching par `product_code` exact (prod code KT visible dans le TMT)
- Si correspondance : `prix_achat` → tarif dans le mail prestataire ; `prestataire_nom` / `prestataire_email` → DESTINATAIRE du mail
- Mail prestataire conditionnel :
  - Avec `prix_achat` connu → "Nous souhaiterions réserver au tarif habituel de [PRIX_ACHAT] € TTC. Pourriez-vous confirmer votre disponibilité et votre accord sur ce tarif :"
  - Sans `prix_achat` → comportement actuel inchangé ("Pourriez-vous nous confirmer votre tarif net agence...")
- Prix dans le corps du mail : `Prix (base Liberty) : **[PRIX_ACHAT] € TTC**` si connu, sinon `Prix : **[PRIX TTC ou PRIX À COMPLÉTER]**`
- Valable pour les trois templates : mail standard, mail hôtel, mail regroupé (chaque section PRESTATION est traitée indépendamment)

**PROMPT_QUOTES.md — comportement si CATALOGUE présent :**
- Matching par sens de la demande (pas de clé exacte requise)
- Si correspondance : label `[DISPONIBLE EN CATALOGUE LIBERTY]` remplace `[SUGGESTION — à valider en base Liberty]`
- `service_name` / `description_courte` → utilisés pour rédiger le service dans les outputs
- `prix_vente` → utilisé dans Output 1 (section "Services à sourcer") et Output 2 (programme client)
- Output 2 : si `prix_vente` disponible → indiquer sobrement dans le paragraphe (ex : "from €X per person") ; sinon → ton narratif sans prix
- `prestataire_nom` → reporté dans Output 4 (checklist actions) si confirmation reste nécessaire
- Phrase de clôture Output 2 : "Pricing shown is indicative based on our current rates and subject to final availability confirmation. Final programme will be confirmed upon your approval of this outline."

### Données sensibles — règles absolues

| Colonne | Jamais au prestataire | Jamais au client |
|---|---|---|
| `acces_plateforme` | ✓ (exclue structurellement par la vue) | ✓ |
| `prix_vente` | ✓ | — (autorisé, c'est le prix client) |
| `prix_achat` | — (autorisé, c'est le tarif prestataire) | ✓ |
| `buy_per_pax_extra` | ✓ | ✓ |
| `prestataire_email` | — (utilisé comme DESTINATAIRE) | ✓ |
| `prestataire_tel` | — | ✓ |
| `conditions_annulation_achat` | ✓ | ✓ |
| `supplements_achat` | ✓ | ✓ |

**Règle structurelle :** `acces_plateforme` n'existe pas dans `rob_providers_catalog_safe` — protection impossible à contourner par inadvertance.

---

## Fonctionnalités principales

### Alfred

- Analyse des emails non lus de la boite connectée (actuellement Gmail Antoine)
- Triage en 4 niveaux : 🔴 Urgent / 🟡 Important / 🟢 Normal / 🧹 Ignoré
- Synthèse globale en tête d'analyse (bloc 📋)
- Draft de réponse pour chaque email Urgent/Important ("Réponse suggérée" + "Copier ce draft")
- Actions : "Nouvelle analyse" (reset + relance), "Copier l'analyse" (export texte brut)

### Agent Kensington

- Input : contenu brut d'un TMT Kensington (copier-coller texte, sans mise en forme)
- Output 1 - Fiche de coordination : référence dossier, profil voyageur, services jour par jour, actions à lancer
- Output 2 - Mails prestataires : un bloc par prestataire avec SERVICE / JOUR / DESTINATAIRE / corps complet
- Fonction regroupement : sélection multi-mails → fusion en 1 mail unique (appel Claude inline)
- Signaux Rob dans la fiche : `[DONNEE MANQUANTE]`, `[A VERIFIER]`, services hors France exclus
- **[v2.2]** Si CATALOGUE injecté par Make : DESTINATAIRE et tarif pré-remplis depuis la base Liberty

### Agent Quotes

- Input : brief client (email brut, anglais ou français, vague ou détaillé)
- Output 0 : Email de questions (brief insuffisant) — délimiteur `===OUTPUT0_START/END===`
- Output 1 : Fiche interne — délimiteur `===OUTPUT1_START/END===`
- Output 2 : Programme client (anglais, ton premium) — délimiteur `===OUTPUT2_START/END===`
- Output 3 : Réponse client (accusé de réception) — délimiteur `===OUTPUT3_START/END===`
- Output 4 : Checklist d'actions (cochable dans l'interface) — délimiteur `===OUTPUT4_START/END===`
- Acte 2 : bloc "Reprendre ce dossier" (visible si brief suffisant), génère le mail de cotation finale depuis les tarifs collectés
- Logique insuffisant : si OUTPUT0 présent ET OUTPUT1+2 vides → mode Incomplet, badge orange, Acte 2 masqué
- **[v2.2]** Si CATALOGUE injecté par Make : services identifiés avec mention `[DISPONIBLE EN CATALOGUE LIBERTY, prix_vente]` et prix indicatif dans le programme client

### Mails dispo

- 5 types : Guide, Assistant, Autre, Hôtel contracté, Hôtel non contracté
- Composition locale (aucun appel IA), envoi via webhook Make
- Aperçu → éditeur riche inline (barre d'outils : gras, italique, souligné, listes, suppr. formatage)
- Bascule Aperçu/Modifier sans perte des modifications (état `mailEditorState` par type)
- Signature auto générée depuis l'objet `ACCOUNTS`

### Quotes DOCX

- Génération Word 100% locale via `docx.js@8.5.0`
- Structure : couverture + tableau services + total TTC + conditions générales + footer Liberty
- Charte : navy `#1C2B4B`, or `#C9A84C`, police Arial
- Nom fichier : `Devis_Liberty_{Client}_{REF}.docx`
- Rien ne transite sur le réseau

### Compta

- Glisser-déposer PDF, encodage base64 côté client
- Envoi vers `invoices.france@liberty-int.com`, copie auto à l'expéditeur
- Champs : objet, n° dossier, montant, date, détenteur
- PDF non stocké par Make

### Comms internes

- Sous-module 1 — Info presta : prestataire, destination, type (liste déroulante), contenu, emplacement BDD
- Sous-module 2 — Récap astreinte : période + incidents répétables (date, heure, n° dossier, description, résolution)
- Éditeur riche inline identique à Mails dispo
- Envoi via second webhook `commsSend` → liste de diffusion équipe FIT préconfigurée dans Make

---

## Stack technique

| Composant | Technologie | Notes |
|---|---|---|
| Frontend | HTML / CSS / JS vanilla | Single-file, ~2600 lignes |
| Hébergement | GitHub Pages | Zéro serveur, déploiement par upload |
| Automatisation | Make.com (EU1) | Relais IA, envoi emails, logique métier |
| IA | Claude (Anthropic API) via Make | claude-sonnet-4 |
| Prompts | Notion | Versionnés hors code, modifiables sans redéploiement |
| Backend / Auth | Supabase (PostgreSQL REST) | Auth, permissions, logs, sessions, catalogue |
| Catalogue prestataires | Supabase `rob_providers_catalog` | 614 lignes, accès via fonction RPC |
| Génération DOCX | docx.js v8.5.0 (CDN jsDelivr) | Local, aucun réseau |
| Email actuel | Gmail (compte personnel Antoine) | Transitoire |
| Email cible | Outlook / Microsoft 365 @liberty-int.com | Dès autorisation Azure AD |
| Polices | Space Grotesk + DM Sans (Google Fonts) | CDN |

---

## Architecture globale

### Vue d'ensemble

```
Navigateur (index.html)
  ├── Auth → Supabase (rob_users)
  ├── Logging → Supabase (rob_logs)
  ├── Session Quotes → Supabase (rob_quotes_sessions)
  ├── Session history → localStorage + Supabase
  ├── Permissions polling → Supabase (toutes les 30s)
  │
  ├── Alfred → Webhook Make → Gmail → Claude → Make → Rob
  ├── Agent Kensington → Webhook Make →
  │     ├── RPC Supabase match_providers_catalog(texte_tmt) → CATALOGUE JSON
  │     ├── Notion (PROMPT_KENSINGTON)
  │     └── Claude (prompt + texte + CATALOGUE) → Make → Rob
  ├── Agent Quotes → Webhook Make →
  │     ├── RPC Supabase match_providers_catalog(texte_brief) → CATALOGUE JSON
  │     ├── Notion (PROMPT_QUOTES)
  │     └── Claude (prompt + texte + CATALOGUE) → Make → Rob
  │           └── Acte 2 cotation → Webhook Make quotes (payload inline) → Claude → Make → Rob
  ├── Comms internes → Webhook Make → Claude → Make → Rob
  │     └── Envoi → Webhook Make commsSend → Gmail → liste FIT
  ├── Mails dispo → Composition locale → Webhook Make → Gmail
  ├── Compta → base64 PDF → Webhook Make → Gmail → invoices.france@
  └── Quotes DOCX → docx.js → téléchargement local (aucun réseau)
```

### Flux catalogue prestataires dans Make

```
[Texte brut brief/TMT]
  → POST /rest/v1/rpc/match_providers_catalog
      Headers: service_role key
      Body: {"input_text": "{{texte}}"}
  → [JSON array des lignes catalogue pour les régions détectées] ou []
  → Injecté dans le payload Claude sous la clé CATALOGUE
  → Claude exploite CATALOGUE selon les règles de PROMPT_KENSINGTON ou PROMPT_QUOTES
```

### Parsing de la réponse Claude

**Kensington** — séparateur entre fiche et mails : `===OUTPUT2===`
Chaque bloc mail délimité par `---MAIL---`, avec headers `SERVICE :`, `JOUR :`, `DESTINATAIRE :`

**Quotes** — 5 blocs délimités :
- `===OUTPUT0_START===` / `===OUTPUT0_END===` → email questions
- `===OUTPUT1_START===` / `===OUTPUT1_END===` → fiche interne
- `===OUTPUT2_START===` / `===OUTPUT2_END===` → programme client
- `===OUTPUT3_START===` / `===OUTPUT3_END===` → réponse client
- `===OUTPUT4_START===` / `===OUTPUT4_END===` → checklist

**Alfred** — parsing par emojis de section : 🔴, 🟡, 🟢, 🧹
Chaque tâche découpée par regex : `/\n---\n|\n(?=\*{0,2}\[[\d]+\])/`
Métadonnées extraites par regex : `De :`, `Reçu le :`, `- Reponse suggeree :`

---

## Structure des fichiers

```
liberty-fit-agent/
├── index.html                    # Application Rob complète (~2600 lignes)
│                                 # HTML + CSS + JS dans un seul fichier
├── admin.html                    # Console d'administration
│                                 # Gestion comptes, journal de connexions
├── rob_guide_utilisateur.html    # Guide utilisateur interactif bilingue FR/EN
├── favicon.svg / .ico / .png     # Icônes
├── apple-touch-icon.png          # Icône mobile iOS
└── tools/
    └── catalog_import/
        ├── catalog_normalized.json  # Source de vérité JSON (614 lignes normalisées)
        ├── gen_sql.js               # Script de génération des batches SQL
        ├── NOTICE_MAKE.md           # Documentation technique Make / RPC / sécurité
        ├── batch_00.sql → batch_30.sql  # Fichiers SQL d'import (archivables)
        └── [fichiers intermédiaires]    # Archivables / supprimables

Hors repo (OneDrive) :
├── PROMPT_KENSINGTON.md          # Prompt agent Kensington (v2.2 — avec section CATALOGUE)
├── PROMPT_QUOTES.md              # Prompt agent Quotes (v2.2 — avec section CATALOGUE)
└── TEMPLATE ACHAT VENTE SERVICES KT 2026_NE PAS TOUCHER.xlsx  # Source Excel LECTURE SEULE
```

---

## Variables d'environnement / Configuration

Rob n'utilise pas de fichier `.env`. Toutes les valeurs sont hardcodées dans `index.html`.

### Supabase

```js
const SUPABASE_URL  = 'https://biknungxkdxtwhdhhxcm.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // clé anon publique
```

### Webhooks Make (EU1)

```js
const WEBHOOKS = {
  kensington: 'https://hook.eu1.make.com/2mp8ancoa1l53tg75x7wvea45bvbmcw8',
  quotes:     'https://hook.eu1.make.com/vj8jql1msq2ukwkj22o5yc98fx5unhv1',
  compta:     'https://hook.eu1.make.com/ovr2e7q79nj1u9y53dl1b6pj8xqasfhg',
  mails:      'https://hook.eu1.make.com/5n8fsqjxxlij3y12w0tuqq7jva9vukio',
  comms:      'https://hook.eu1.make.com/5wnesfvbhudi0k6sl92qwmxc46u0alt9',
  commsSend:  'https://hook.eu1.make.com/s1r8k4akr5ltn3anf6734p3wrk4chhz3',
  alfred:     'https://hook.eu1.make.com/s4v3otb73bfupx3wla4p42m6efep6vxh',
};
```

### Variables d'environnement Make (non dans le code Rob)

- `SUPABASE_SERVICE_ROLE_KEY` — clé service_role Supabase, stockée dans les variables d'environnement du scénario Make uniquement. **Jamais dans le code Rob.**
- `ANTHROPIC_API_KEY` — clé API Claude, dans Make uniquement.

### Comptes utilisateurs (fallback local — source de vérité : Supabase)

```js
const ACCOUNTS = {
  'antoine.fonfreyde': { display: 'Antoine Fonfreyde', role: 'Admin · Liberty FIT' },
  'romain.ammari':     { display: 'Romain Ammari',     role: 'Chef de projet FIT' },
  'frederique.jehl':   { display: 'Frederique Jehl',   role: 'Chef de projet FIT' },
  'cristina.badino':   { display: 'Cristina Badino',   role: 'Chef de projet FIT' },
  'emma.vandenesse':   { display: 'Emma Vandenesse',   role: 'Chef de projet FIT' },
  'sandra.verchin':    { display: 'Sandra Verchin',    role: 'Chef de projet FIT' },
  'guest.liberty':     { display: 'Invite Liberty',    role: 'Acces demonstration' },
};
```

---

## APIs et services externes

| Service | Rôle | Criticité |
|---|---|---|
| Supabase REST API | Auth, permissions, logs, sessions Quotes, catalogue prestataires | Critique |
| Supabase RPC | `match_providers_catalog` — filtrage catalogue avant chaque appel Claude | Critique pour v2.2 |
| Make.com (EU1) | Orchestration IA, envoi emails, relais webhooks, appel RPC catalogue | Critique pour tous les modules IA et envois |
| Anthropic Claude API | Traitement langage, génération contenu | Critique pour Kensington, Quotes, Alfred, Comms |
| Notion API | Lecture prompts agents (PROMPT_KENSINGTON, PROMPT_QUOTES, etc.) | Critique pour la qualité des outputs IA |
| Gmail API | Envoi emails (transitoire) | Requis pour Mails dispo, Compta, Comms envoi |
| Google Fonts CDN | Space Grotesk + DM Sans | Dégradé gracieux si indispo |
| jsDelivr CDN | docx.js v8.5.0 | Requis pour Quotes DOCX uniquement |

### Dépendances à venir

- **Microsoft 365 / Outlook / Azure AD** : OAuth2 via Make, dès autorisation IT (Tomasz)
- **API Kensington Tours** : import TMT direct via référence dossier (feuille de route)

---

## Fonctionnement de l'IA

### Modèle

- **Claude (Anthropic)** via Make.com — `claude-sonnet-4`
- Aucun appel direct à l'API Anthropic depuis le navigateur — tout passe par Make

### Prompts

- Stockés dans **Notion** (PROMPT_KENSINGTON, PROMPT_QUOTES) — **Notion est l'unique source de vérité lue par Make en production**
- Les fichiers `.md` locaux (`PROMPT_KENSINGTON.md`, `PROMPT_QUOTES.md`) sont des miroirs de travail pour Claude Code uniquement — ils ne sont jamais lus par Make et peuvent diverger de Notion si Antoine ne colle pas les modifications
- Make lit le prompt Notion à chaque appel → modification immédiate sans redéploiement
- Seul Antoine a accès aux pages Notion de prompt

### Agents et comportements clés

**PROMPT_KENSINGTON** (v2.2) :
- Fiche de coordination avec `[DONNEE MANQUANTE]` et `[A VERIFIER]`
- Blocs mails séparés par `---MAIL---` avec headers `SERVICE :`, `JOUR :`, `DESTINATAIRE :`
- Marqueur `===OUTPUT2===` entre fiche et mails
- Si CATALOGUE présent : matching par product_code exact → pré-remplissage DESTINATAIRE + tarif
- Templates mails conditionnels selon présence/absence de prix_achat catalogue
- Données interdites côté prestataire : `prix_vente`, `buy_per_pax_extra`, `conditions_annulation_achat`, `supplements_achat`, `acces_plateforme`

**PROMPT_QUOTES** (v2.2) :
- 5 outputs délimités par leurs marqueurs `===OUTPUTn_START/END===`
- OUTPUT0 vide si brief suffisant, OUTPUT1+2 vides si brief insuffisant
- Hypothèses signalées `[HYPOTHESE]`, suggestions `[SUGGESTION — à valider en base Liberty]`
- Si CATALOGUE présent et correspondance trouvée : `[DISPONIBLE EN CATALOGUE LIBERTY, prix_vente]`
- Output 2 : `prix_vente` catalogue indiqué sobrement si disponible ("from €X per person")
- Phrase de clôture Output 2 : "Pricing shown is indicative based on our current rates and subject to final availability confirmation. Final programme will be confirmed upon your approval of this outline."
- Données interdites côté client : `prix_achat`, `buy_per_pax_extra`, `prestataire_email`, `prestataire_tel`, `conditions_annulation_achat`, `supplements_achat`, `acces_plateforme`

**Acte 2 Quotes — Cotation finale** (payload inline, hardcodé dans `runCotation()`) :
```
===COTATION===
BRIEF ORIGINAL : {brief}
FICHE INTERNE GÉNÉRÉE : {o1}
TARIFS RASSEMBLÉS : {tarifs}
Génère uniquement le mail de cotation finale... ton Liberty premium. Propose un objet en première ligne (format : Objet : [...]).
```
⚠️ **Contrainte connue** : la fonction `runCotation()` (index.html ligne 1761) exige que le champ "Tarifs rassemblés" soit non vide (garde ligne 1764 : `if (!tarifs) { showErr(...); return; }`). L'auto-déclenchement de l'Acte 2 depuis les prix_vente catalogue nécessiterait de modifier cette garde → hors périmètre actuel.

### Parsing des réponses Claude

**Problème connu** : Claude peut produire du markdown (bold `**...**`, séparateurs `---`) qui casse les regex JS.

Correctifs appliqués dans `renderAlfred()` et `buildAlfredTaskCard()` :
- Nettoyage `**` dans les sujets : `.replace(/\*\*/g, '')`
- Regex découpage tâches : `/\n---\n|\n(?=\*{0,2}\[[\d]+\])/`
- Rendu HTML bold : `.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')`
- Nettoyage numéros de tâche : `.replace(/^\*{0,2}\[[\d]+\]\*{0,2}\s*/, '')`

**Règle d'or** : tout nouveau parsing de réponse Claude doit anticiper le markdown. Ne jamais supposer que Claude renvoie du texte brut.

---

## UX / Produit

### Expérience visée

Interface sobre, haut de gamme, rapide. Pas d'onboarding complexe. Un chef de projet ouvre Rob, lance Alfred pour trier ses emails, puis traite ses dossiers un à un. Le tout sans quitter l'interface ni ouvrir d'autre outil.

### Parcours utilisateur typique

1. Connexion (sélection identifiant + mot de passe)
2. Alfred : "Analyser mes emails" → vue triée des emails du jour
3. Agent Kensington : coller un TMT → fiche + mails prêts en < 1 min (avec tarifs catalogue si région couverte)
4. Mails dispo : formulaire guidé → aperçu → modifier si besoin → copier dans Outlook (ou envoyer directement)
5. Agent Quotes : coller un brief → programme client + fiche interne → Acte 2 après collecte des tarifs
6. Compta : glisser-déposer facture → envoi automatique
7. Comms internes : info presta ou récap astreinte → envoyer à l'équipe

### Contraintes UX

- Interface optimisée desktop — mobile fonctionnel mais non prioritaire
- Pas de navigation multi-pages (SPA), tout sur `index.html`
- Les résultats restent visibles pendant toute la session (pas d'effacement entre modules)
- Le module actif est surligné en jaune dans la grille
- Un banner ambre apparaît si certaines permissions sont désactivées sur le compte
- L'historique de session est persistant — les 8 derniers dossiers rechargent sans regénérer

### Charte graphique

- Fond : anthracite `#0D0D0C` / `#111110` / `#1A1918`
- Accent : jaune `#F5E642`
- Texte : gris clair `#B4B2A9` / `#D3D1C7`
- Titres : Space Grotesk
- Corps : DM Sans
- États : rouge `#F09595` / vert `#A8CC80` / ambre `#FAC775`

---

## Base de données (Supabase)

**Projet ID :** `biknungxkdxtwhdhhxcm`
**URL :** `https://biknungxkdxtwhdhhxcm.supabase.co`

### Table `rob_users`

| Colonne | Type | Description |
|---|---|---|
| `username` | text (PK) | Identifiant de connexion |
| `password_hash` | text | SHA-256 du mot de passe |
| `active` | boolean | Compte activé ou non |
| `level` | text | `admin` ou `user` |
| `permissions` | jsonb | Objet 7 clés booléennes |
| `display_name` | text | Nom affiché dans l'interface |
| `role_label` | text | Label de rôle affiché en footer |

### Table `rob_logs`

| Colonne | Type | Description |
|---|---|---|
| `username` | text | Identifiant connecté |
| `connected_at` | timestamptz | Horodatage de la connexion |

### Table `rob_quotes_sessions`

| Colonne | Type | Description |
|---|---|---|
| `username` | text | Identifiant utilisateur |
| `client` | text | Nom du client extrait de la fiche interne |
| `brief_raw` | text | Brief original collé par l'utilisateur |
| `output1` | text | Fiche interne générée |
| `output2` | text | Programme client généré |
| `output3` | text | Réponse client générée |
| `output4` | text | Checklist générée |
| `tarifs_raw` | text | Tarifs collés en Acte 2 (optionnel) |
| `output_cotation` | text | Mail de cotation finale (optionnel) |
| `session_id` | bigint | `Date.now()` au moment de la génération |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Dernière mise à jour (Acte 2) |

### Table `rob_providers_catalog`

614 lignes. Contient `acces_plateforme` (TEXT, identifiants plateformes) — **jamais exposée directement**.

**28 colonnes INSERT** (dans cet ordre exact, sans `id` ni `imported_at`) :
`sheet_source, region, location, service_type, service_name, description_courte, product_code, rate_names, season_start, season_end, prix_vente, conditions_annulation_vente, supplements_vente, prix_achat, conditions_annulation_achat, supplements_achat, buy_per_pax_extra, prestataire_nom, prestataire_email, prestataire_tel, mode_paiement, prestataire_code, prestataire_nom_2, prestataire_email_2, prestataire_tel_2, notes, tmt_link, acces_plateforme`

Colonnes JSONB : `prix_vente`, `prix_achat`, `supplements_achat`, `buy_per_pax_extra` (cast `::jsonb` en INSERT).

**RLS activé** — aucune policy SELECT pour `anon`. Accessible uniquement via `service_role` ou via la vue safe.

### Vue `rob_providers_catalog_safe`

Expose toutes les colonnes de `rob_providers_catalog` **sauf `acces_plateforme`**. C'est la seule source que Make et la fonction RPC sont autorisés à lire.

```sql
CREATE OR REPLACE VIEW public.rob_providers_catalog_safe AS
SELECT
  id, sheet_source, region, location, service_type, service_name, description_courte,
  product_code, rate_names, season_start, season_end,
  prix_vente, conditions_annulation_vente, supplements_vente,
  prix_achat, conditions_annulation_achat, supplements_achat, buy_per_pax_extra,
  prestataire_nom, prestataire_email, prestataire_tel, mode_paiement,
  prestataire_code, prestataire_nom_2, prestataire_email_2, prestataire_tel_2,
  notes, tmt_link, imported_at
  -- acces_plateforme intentionnellement exclue
FROM public.rob_providers_catalog;
```

### Table `rob_region_locations`

Table de mapping location → région, utilisée par `match_providers_catalog`.

| Colonne | Type | Description |
|---|---|---|
| `id` | integer (PK) | Auto-increment |
| `location` | text | Nom de la ville/lieu (ex : "Aix en Provence") |
| `region` | text | Région catalogue correspondante (ex : "Provence") |

Utilisée via `ILIKE '%' || r.location || '%'` — matching insensible à la casse, sous-chaîne.

### Fonction `match_providers_catalog`

```sql
-- Signature
public.match_providers_catalog(input_text text) RETURNS json

-- Permissions
-- EXECUTE : postgres (owner), service_role
-- Révoqué de : PUBLIC, anon, authenticated
-- SECURITY INVOKER (s'exécute avec les droits du rôle appelant)
```

---

## Sécurité et contraintes

### Authentification

- Mot de passe haché SHA-256 côté client (Web Crypto API) avant envoi à Supabase
- Comparaison hash vs hash en base — le mot de passe en clair ne transite jamais
- Liste des comptes chargée dynamiquement depuis Supabase au chargement de la page login
- En cas d'échec Supabase : fallback sur l'objet `ACCOUNTS` local (affichage seul, pas d'auth)

### Sécurité admin — POINT CRITIQUE

- **Le niveau admin est toujours lu depuis Supabase (`rec.level`), jamais depuis `localStorage`**
- Correctif appliqué suite à une vulnérabilité détectée : l'ancienne version lisait le niveau depuis localStorage, permettant une élévation de privilèges côté client
- **Ne jamais revenir à une lecture du level depuis localStorage ou sessionStorage**

### Permissions

- 7 permissions distinctes par compte dans `permissions` JSONB Supabase
- Polling toutes les 30 secondes : révocation possible en temps réel sans déconnexion forcée
- Un compte désactivé (`active: false`) est déconnecté au prochain polling (sauf admin)
- Les boutons d'action sont désactivés visuellement (opacity 0.3, cursor not-allowed) et fonctionnellement (disabled)

### Catalogue prestataires — sécurité

- `rob_providers_catalog` : RLS activé, aucune policy SELECT pour `anon`
- `rob_providers_catalog_safe` : vue excluant `acces_plateforme` — seule source autorisée pour Make/Claude
- `match_providers_catalog` : EXECUTE révoqué de `anon` et `authenticated`, accordé à `service_role` uniquement
  - **Preuve live (21/06/2026)** : appel HTTP avec clé anon → HTTP 401 + code Postgres `42501 permission denied for function match_providers_catalog`
- Make utilise la `service_role key` (variable d'environnement Make), **jamais dans le code Rob**

### Données utilisateurs

- Les saisies (TMT, briefs, noms clients) transitent vers Anthropic via HTTPS chiffré
- Politique Anthropic : non-rétention des données transmises via API
- Rob ne journalise pas le contenu des saisies, uniquement les connexions (qui, quand)
- Les PDFs Compta transitent encodés base64 via HTTPS, non stockés par Make

---

## Décisions techniques importantes

| Décision | Raison |
|---|---|
| **Single-file `index.html`** | Maintenabilité solo, déploiement par simple upload GitHub Pages, zéro build system |
| **Pas de framework JS** | Même raison — pas de node_modules, pas de build, pas de dépendances à maintenir |
| **Supabase pour les permissions** | Gestion des accès en temps réel sans redéploiement, révocation instantanée |
| **Prompts dans Notion, hors code** | Modification du comportement IA sans toucher au code ni redéployer |
| **Make comme relais universel** | Découplage total entre Rob et les APIs externes |
| **docx.js en local pour DOCX** | Aucun transit de données sensibles pour les devis, zéro dépendance serveur |
| **localStorage + Supabase pour l'historique** | localStorage pour la rapidité en session, Supabase pour la persistance cross-device |
| **SHA-256 côté client** | Le mot de passe en clair ne transite jamais, même vers Supabase |
| **Polling 30s permissions** | Révocation d'accès en temps réel sans nécessiter de déconnexion manuelle |
| **Fonction RPC `match_providers_catalog`** | Encapsule toute la logique région/filtrage dans Postgres — Make n'a qu'un seul module à configurer |
| **SECURITY INVOKER sur la fonction RPC** | La fonction s'exécute avec les droits de l'appelant — service_role bypasse RLS, anon révoqué |
| **Vue `rob_providers_catalog_safe`** | Protection structurelle de `acces_plateforme` — impossible à exposer par inadvertance |
| **Acte 2 sans auto-déclenchement** | La garde `if (!tarifs)` de `runCotation()` (index.html) reste en place — modifier index.html hors périmètre du chantier catalogue |

---

## Conventions de développement

### Structure du fichier `index.html`

Organisé en sections commentées dans cet ordre :
1. `<style>` — CSS complet
2. HTML structurel (login-screen, app-screen, header, grille, panels par module, footer)
3. `<script src="docx CDN">`
4. `<script>` — JS par sections commentées :
   - `// SUPABASE` → `// ACCOUNTS` → `// WEBHOOKS` → `// STATE`
   - `// AUTH` — `sha256()`, `doLogin()`, `loadLoginUsers()`
   - `// PERMISSIONS` — `PERM_BUTTONS`, `applyPermissions()`
   - `// MODULE SWITCHING` — `setMod()`
   - `// ALFRED` — `runAlfred()`, `renderAlfred()`, `buildAlfredTaskCard()`
   - `// KENSINGTON` — `runKensington()`, `renderKensington()`, `mergeMails()`
   - `// QUOTES AGENT` — `runQuotes()`, `renderQuotes()`, `renderChecklist()`, `runCotation()` (ligne ~1761)
   - `// SESSION HISTORY` — `loadSessionHistory()`, `addToSessionHistory()`, `restoreSession()`
   - `// QUOTE SESSION PERSISTENCE` — `saveQuoteSession()` (Supabase)
   - `// COMMS INTERNES` — `buildCommsPayload()`, `runComms()`, `sendComms()`
   - `// MAILS DISPO` — `setMailType()`, `buildMailBody()`, `previewMail()`, `sendMail()`
   - `// RICH EDITOR` — `applyRichFmt()`, `setMailEditorMode()`, `setCommsEditorMode()`
   - `// QUOTES DOCX` — `generateDocx()`
   - `// COMPTA` — `sendCompta()`, `fileToB64()`
   - `// HELPERS` — `parseWebhookText()`, `mdToHtml()`, utilitaires UI

### Conventions de nommage

- IDs HTML : kebab-case préfixé par le module (`kt-`, `qt-`, `al-`, `mail-`, `ct-`, `qd-`, `comms-`)
- Variables JS : camelCase
- Constantes : SCREAMING_SNAKE_CASE
- Classes CSS : kebab-case

### Patterns importants

- Tous les appels réseau sont `async/await` avec `try/catch/finally`
- Le `finally` remet toujours le bouton en état (disabled false, spinner masqué, label restauré)
- `parseWebhookText()` gère le cas où Make renvoie un array JSON ou un objet `{text}` au lieu de texte brut
- `mdToHtml()` convertit le markdown bold en `<strong>` — utilisé pour tous les résultats Claude
- `esc()` échappe le HTML pour l'affichage sécurisé des corps de mails

### Textes et langue

- Pas de tirets cadratins (—) dans les textes français de l'interface
- Le guide utilisateur est bilingue FR/EN via l'objet `T` et la fonction `setLang()`
- Toute nouvelle chaîne de texte dans le guide doit être ajoutée dans `T.fr` et `T.en`

---

## Commandes utiles

### Déploiement

Rob n'a pas de système de build. Le déploiement est un simple upload de fichier sur GitHub.

```bash
git clone https://github.com/fonfreydeantoine/liberty-fit-agent.git
cd liberty-fit-agent
# Modifier index.html
git add index.html
git commit -m "Description de la modification"
git push origin main
# GitHub Pages se met à jour automatiquement en 1-2 minutes
```

### Accès Supabase

```
URL dashboard : https://supabase.com/dashboard/project/biknungxkdxtwhdhhxcm
Tables        : rob_users, rob_logs, rob_quotes_sessions, rob_providers_catalog, rob_region_locations
Vue           : rob_providers_catalog_safe
Fonction RPC  : match_providers_catalog(input_text text)
```

### Tests manuels

```
1. Ouvrir https://fonfreydeantoine.github.io/liberty-fit-agent/
2. Se connecter avec antoine.fonfreyde
3. Tester chaque module avec des données réelles
4. Vérifier les webhooks Make (tableau de bord Make.com)
5. Vérifier les logs Supabase si besoin
```

### Vérifier l'état du catalogue en base

```sql
-- Nombre total de lignes
SELECT COUNT(*) FROM rob_providers_catalog;  -- doit retourner 614

-- Doublons product_code inattendus (exclure les 12 intentionnels)
SELECT product_code, COUNT(*) as n
FROM rob_providers_catalog
WHERE product_code IS NOT NULL
GROUP BY product_code
HAVING COUNT(*) > 1
  AND product_code NOT IN (
    'AUDPVTRFBAYTRAIN','BAYPVPORT','BAYPVTRFBAYTRAIN','BAYPVTRFCAEN',
    'BAYTRAINPVTRFAUD','CFRPVPEB','CFRPVTRFBAY','DEAPVTRFBAY',
    'DEAPVTRFC','DEAPVTRFDEATRAIN','DEAPVTRFHON','PEBPVTRFBAYTRAIN'
  )
ORDER BY n DESC;

-- Test fonction RPC (à exécuter avec service_role)
SELECT json_array_length(match_providers_catalog('Aix en Provence'));
-- doit retourner 38 (région Provence)

SELECT match_providers_catalog('London city tour');
-- doit retourner []
```

---

## Déploiement

- **Hébergement** : GitHub Pages (repo public `fonfreydeantoine/liberty-fit-agent`)
- **Branche** : `main` — GitHub Pages sert directement depuis cette branche
- **CI/CD** : aucun — déploiement manuel par upload ou push Git
- **Domaine** : `fonfreydeantoine.github.io/liberty-fit-agent/`
- **HTTPS** : fourni automatiquement par GitHub Pages
- **Temps de propagation** : 1 à 2 minutes après push

---

## Bugs connus / Dette technique

### Dette active

- **Clé Supabase anon dans le code source** : normal pour une clé anon, mais à surveiller si les règles RLS ne sont pas correctement configurées
- **Pas de suite de tests automatisés** : toute régression est détectée manuellement
- **Pas de gestion d'erreur Notion** : si Make ne peut pas lire le prompt Notion, l'erreur remonte comme une erreur Make générique
- **docx.js v8.5.0 via CDN jsDelivr** : dépendance externe non verrouillée
- **SHA-256 côté client** : protection suffisante pour un outil interne, insuffisante pour un contexte production public
- **Acte 2 sans auto-déclenchement catalogue** : la garde `if (!tarifs)` dans `runCotation()` (index.html ligne 1764) bloque le déclenchement avec champ tarifs vide — limites cataloguées, décision de ne pas modifier index.html dans ce sprint

### Pièges connus

- **Markdown Claude dans les parsings** : Claude produit du markdown (bold, séparateurs) — tout nouveau parsing doit en tenir compte
- **`parseWebhookText()`** : Make peut renvoyer un array JSON `[{type:"text",text:"..."}]` ou un objet `{text:"..."}`. Toujours passer par cette fonction
- **Acte 2 Quotes** : le bloc est contrôlé par `acte2.classList.add('visible')` uniquement si `!insuff && o1`. Ne pas afficher si le brief est insuffisant
- **Permissions** : les permissions sont lues en session depuis `userRecord.permissions`, mis à jour par le polling. Ne pas lire depuis localStorage
- **Admin level** : toujours lire depuis `rec.level` (Supabase), jamais depuis localStorage ou sessionStorage
- **Fonction match_providers_catalog + anon** : si la clé anon est utilisée par erreur dans Make, l'appel retourne HTTP 401 — vérifier que c'est bien la service_role key configurée dans Make

### Anomalies catalogue connues et non corrigées

- `service_type = '65'` sur une ligne BAYPVTRFBAYTRAIN (erreur Excel, non bloquante)
- `DIJPV TRFCHASAO` : espace dans le product_code (non bloquant)
- 4 ids (94-97) avec codes Moulin Rouge contenant `*includes* PARPVCAR&DRIVER5`
- ids 105, 248 : product_code NULL
- ids 496-497 HONPVTRF5/6 : prix_achat NULL, à vérifier manuellement

---

## Roadmap / Prochaines étapes

### Immédiat — configuration Make requise

- [ ] **Scénario Kensington** : ajouter module RPC `match_providers_catalog` avant l'appel Claude, injecter résultat sous clé `CATALOGUE`
- [ ] **Scénario Quotes** : même chose
- [ ] Tester end-to-end avec un vrai TMT Kensington contenant une destination couverte (ex : Bayeux, Deauville, Aix en Provence)

### Court terme (dépend IT Tomasz / Azure AD)

- [ ] Connexion Make → Outlook @liberty-int.com via OAuth2 / Azure AD
- [ ] Activation envoi mails depuis adresses Liberty pour tous les utilisateurs
- [ ] Activation Alfred sur boite Outlook @liberty-int.com
- [ ] Recap matinal automatique des dossiers Kensington + Quotes reçus hors heures ouvrées

### Catalogue — corrections optionnelles

- [ ] Identifier les vrais codes KT pour les 11 codes provisoires (Moulin Rouge × 4, transferts manquants × 4, Shorex × 3)
- [ ] UPDATE en base pour ids 94-97 (Moulin Rouge) si matching KT requis
- [ ] Vérification manuelle HONPVTRF5/6 (ids 496-497) — prix_achat à compléter
- [ ] Décider des codes pour ids 105 et 248 (product_code NULL)
- [ ] Archiver ou supprimer les fichiers `batch_XX.sql` de `tools/catalog_import/`

### Moyen terme

- [ ] Migration Make Pro (personnel) → Make Teams sous entité Liberty
- [ ] Migration API Anthropic personnelle → Workspace Anthropic Liberty
- [ ] Migration GitHub Pages vers organisation Liberty gratuite
- [ ] Templates personnalisés par utilisateur

### Futur

- [ ] Acte 2 auto-déclenchement : modifier la garde `if (!tarifs)` dans `runCotation()` (index.html ligne 1764) pour permettre le déclenchement automatique quand les prix_vente catalogue couvrent tous les services — **nécessite modification index.html**
- [ ] Connexion calendrier Outlook
- [ ] Import TMT direct depuis Kensington via référence dossier
- [ ] Roadbook client PDF (brief → livrable final dans la charte Liberty)
- [ ] Réplication Rob pour pôles FIT Liberty Espagne et Portugal
- [ ] Versions MICE et Leisure Liberty France

---

## Ce qu'un agent IA doit absolument savoir

### Ce qu'il ne faut JAMAIS faire

1. **Ne jamais lire le niveau admin depuis localStorage** — toujours depuis Supabase `rec.level`
2. **Ne jamais supposer que Claude renvoie du texte brut** — anticiper le markdown dans tous les parsings
3. **Ne jamais casser le parsing des marqueurs délimiteurs** des modules Kensington et Quotes
4. **Ne jamais modifier la structure de `PERM_BUTTONS`** sans mettre à jour le schéma Supabase `permissions` en parallèle
5. **Ne jamais introduire de framework JS ou de système de build** — Rob doit rester un single-file sans dépendances de build
6. **Ne jamais stocker de données sensibles dans localStorage** — uniquement l'historique de session
7. **Ne jamais fragmenter `index.html` en plusieurs fichiers** sans validation explicite d'Antoine
8. **Ne jamais interroger `rob_providers_catalog` directement** — toujours passer par `rob_providers_catalog_safe` ou la fonction RPC
9. **Ne jamais utiliser la clé `anon` pour appeler `match_providers_catalog`** — service_role uniquement
10. **Ne jamais inclure `acces_plateforme` dans un payload Claude** — colonne absente de la vue safe par construction
11. **Ne jamais modifier `index.html` pour l'Acte 2 auto-déclenchement** sans décision explicite d'Antoine (hors périmètre catalogue)

### Contraintes métier à respecter

- Le module Quotes DOCX **doit rester 100% local** (aucun transit réseau des données de devis)
- Les prompts agents **restent dans Notion** — ne jamais les mettre dans `index.html`
- La signature des mails est **toujours générée automatiquement** depuis `ACCOUNTS`
- Les services "Booked by client" et le Welcome Package **ne génèrent jamais de mail prestataire** dans Kensington
- L'Acte 2 Quotes **n'apparaît jamais** si le brief est insuffisant (condition : `!insuff && o1`)
- Le prestataire ne doit **jamais voir** : `prix_vente`, `buy_per_pax_extra`, `conditions_annulation_achat`, `supplements_achat`, `acces_plateforme`
- Le client ne doit **jamais voir** : `prix_achat`, `buy_per_pax_extra`, `prestataire_email`, `prestataire_tel`, `conditions_annulation_achat`, `supplements_achat`, `acces_plateforme`

### Comportements attendus de Claude (modèle IA)

- Kensington : baliser la fiche avec `[DONNEE MANQUANTE]` et `[A VERIFIER]`, le marqueur `===OUTPUT2===` doit être exact
- Quotes : les 5 marqueurs `===OUTPUTn_START/END===` doivent être exacts — tout écart casse le parsing
- Alfred : débuter les sections avec les emojis exacts (🔴, 🟡, 🟢, 🧹) et préfixer les drafts par `Reponse suggeree :`
- Si un prompt Notion change de format de sortie, le JS de parsing doit être mis à jour en parallèle
- Kensington avec CATALOGUE : matching product_code EXACT uniquement (pas d'approximation)
- Quotes avec CATALOGUE : matching par sens de la demande (pas de clé exacte)

### Conventions implicites

- Les tirets cadratins (—) sont proscrits dans les textes français de l'interface et des emails
- Le ton des emails et programmes clients est "Liberty premium" — professionnel, sobre, sans superlatifs
- Les hypothèses dans les programmes Quotes sont balisées `[HYPOTHESE]`
- Les suggestions d'hôtels/expériences sans correspondance catalogue sont balisées `[SUGGESTION — à valider en base Liberty]`
- Toute modification du guide `rob_guide_utilisateur.html` doit être faite dans les deux langues (`T.fr` et `T.en`)

### Parties sensibles

- **`applyPermissions()`** : fonction centrale de contrôle d'accès — toute modification peut ouvrir des accès non voulus
- **`doLogin()`** : flux d'authentification — la vérification `rec.level !== 'admin'` pour l'activation est intentionnelle
- **`saveQuoteSession()` et `runCotation()`** : les deux points d'écriture Supabase pour les sessions Quotes — les erreurs doivent être silencieuses (`.catch(() => {})`) pour ne pas bloquer l'UX
- **Webhooks Make** : les URLs sont des secrets fonctionnels — ne jamais les exposer dans des logs publics
- **`runCotation()` ligne 1764** : garde `if (!tarifs)` — intentionnelle, hors périmètre catalogue, ne pas supprimer sans décision explicite

---

## Contexte business / Stratégie

### Cible

Équipe FIT Liberty France (6 chefs de projet + 1 Product Manager). Outil 100% interne, pas de commercialisation prévue à ce stade.

### Différenciation

- Rob est le seul outil IA du marché DMC conçu spécifiquement pour le workflow FIT Kensington
- Il connaît la structure des TMT, le vocabulaire Liberty, le ton des communications prestataires
- Depuis v2.2 : il connaît les tarifs et contacts prestataires Liberty et les pré-remplit automatiquement

### Stratégie produit

- Phase 1 : adoption par l'équipe FIT France (en cours)
- Phase 2 : connexion Outlook (dépend IT), activation Alfred généralisée, intégration catalogue Make
- Phase 3 : réplication pour les bureaux Liberty Espagne et Portugal
- Phase 4 : déclinaisons MICE et Leisure

### Gouvernance

- **Antoine Fonfreyde** : maintien technique, développement, admin Rob
- **Philomène Goncalves** : Product Manager Liberty France (partie prenante produit)
- **Carlos** : CEO, approbateur budget et vision
- **Tomasz (IT Liberty)** : autorisation Azure AD — déblocage critique pour la phase 2

---

## Historique des décisions importantes

| Date | Décision | Contexte |
|---|---|---|
| Démarrage | Single-file HTML, GitHub Pages | Maintenabilité solo — pas de serveur, pas de build |
| Démarrage | Make comme relais IA | Découplage Rob du provider IA |
| Démarrage | Prompts dans Notion | Modification comportement IA sans redéploiement |
| v1.x | Authentification par mot de passe simple | Outil interne, équipe restreinte, compromis pragmatique |
| v2.x | Migration vers Supabase | Permissions en temps réel, journal connexions, historique persistant |
| v2.x | Correctif sécurité admin level | Le level admin était lu depuis localStorage → vulnérabilité d'élévation de privilèges. Corrigé : lecture depuis Supabase uniquement |
| v2.x | Ajout éditeur riche inline | Retour terrain : les utilisateurs voulaient modifier les mails générés avant envoi |
| v2.x | Correctifs parsing Alfred | Claude produisait du markdown qui cassait les regex JS |
| v2.1 | Agent Quotes : 5 outputs | Ajout réponse client + checklist |
| v2.1 | Acte 2 Quotes | Flux de cotation finale une fois les tarifs collectés |
| v2.1 | Historique session persistant | Supabase + localStorage pour survivre à la fermeture d'onglet |
| v2.2 (21/06/2026) | Import catalogue 614 lignes | Base prestataires Liberty complète en Supabase |
| v2.2 (21/06/2026) | Fonction RPC `match_providers_catalog` | Encapsule détection région + filtrage en Postgres — Make réduit à 1 module |
| v2.2 (21/06/2026) | Permissions RPC restreintes à service_role | REVOKE de PUBLIC/anon/authenticated confirmé par test HTTP live (HTTP 401) |
| v2.2 (21/06/2026) | PROMPT_KENSINGTON + PROMPT_QUOTES mis à jour | Section CATALOGUE + templates conditionnels selon présence prix_achat/prix_vente |
| v2.2 (21/06/2026) | Acte 2 auto-déclenchement déclaré hors périmètre | Nécessite modification index.html (`runCotation()` ligne 1764) — à traiter dans une session dédiée |

---

## Informations à compléter

### Questions ouvertes

- Quelle est la date prévue pour l'autorisation Azure AD par Tomasz ? (bloque phase 2 complète)
- Les scénarios Make sont-ils exportés et versionnés quelque part en dehors de Make.com ?
- Les prompts Notion sont-ils versionnés (historique des versions dans Notion) ?
- Y a-t-il un monitoring des webhooks Make (alertes en cas d'échec de scénario) ?
- La migration Make Teams a-t-elle une deadline ?
- Le compte `guest.liberty` est-il actif ? Quel mot de passe ?
- Y a-t-il un RLS Supabase configuré sur `rob_users` et `rob_logs` (en dehors de `rob_providers_catalog`) ?

### Catalogue — zones floues

- Les 11 codes provisoires sont-ils definitifs ou les vrais codes KT seront-ils identifiés et mis à jour ?
- La table `rob_region_locations` est-elle exhaustive ou faut-il ajouter des entrées pour des localisations manquantes ?
- Faut-il ajouter un filtre saisonnier dans `match_providers_catalog` (les saisons sont des dates texte ou date selon la cellule Excel source — certaines sont ISO, d'autres texte libre) ?
- Faut-il une version de la fonction sans `prix_achat` pour les scénarios Quotes (défense en profondeur) ou les règles prompt suffisent-elles ?
- Faut-il un second filtrage Make pour limiter les colonnes retournées selon le contexte (Kensington vs Quotes) ?

### Zones floues produit

- Format exact attendu par le prompt Alfred pour la boite Outlook (pourrait différer de Gmail)
- Comportement souhaité si Supabase est indisponible au login
- Stratégie de backup si Make.com est en panne (aucune actuellement)
- Accès concurrents : si deux utilisateurs modifient le même dossier Quotes, la session Supabase est last-write-wins — acceptable ?
