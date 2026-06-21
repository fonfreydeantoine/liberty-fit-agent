# NOTICE — Scénario Make : interrogation du catalogue prestataires

**Table source :** `rob_providers_catalog` (Supabase, projet `rob_liberty`)
**Accès Make :** fonction RPC `match_providers_catalog` — jamais la table ni la vue directement

---

## Architecture : un seul appel Make

Toute la logique de détection de région et de filtrage du catalogue est encapsulée dans la
fonction Postgres `match_providers_catalog`. Make n'a qu'un module à configurer : un appel
RPC avec le texte brut du brief en entrée, dont le résultat JSON est injecté dans le payload
Claude sous la clé `CATALOGUE`.

---

## Appel RPC

**Endpoint :**
```
POST https://biknungxkdxtwhdhhxcm.supabase.co/rest/v1/rpc/match_providers_catalog
```

**Headers :**
```
apikey:        [SERVICE_ROLE_KEY]
Authorization: Bearer [SERVICE_ROLE_KEY]
Content-Type:  application/json
```

**Body :**
```json
{"input_text": "{{texte_brut_du_brief}}"}
```

**Réponse :** tableau JSON des lignes de catalogue correspondant aux régions détectées.
Injecter ce tableau directement dans le payload Claude sous la clé `CATALOGUE`.

Si aucune localisation connue n'est trouvée dans le texte → retourne `[]` → CATALOGUE vide →
les prompts Kensington et Quotes se comportent comme si le catalogue était absent (pas
d'erreur, comportement de fallback activé).

---

## Ce que fait la fonction

```sql
-- Signature
match_providers_catalog(input_text text) RETURNS json

-- Logique
-- 1. Cherche dans rob_region_locations les locations présentes dans input_text (ILIKE)
-- 2. Récupère les régions correspondantes
-- 3. Retourne json_agg de toutes les lignes rob_providers_catalog_safe pour ces régions
-- 4. Retourne [] si aucune correspondance
```

Source de vérité : la vue `rob_providers_catalog_safe` (jamais la table brute). La colonne
`acces_plateforme` (identifiants plateformes prestataires) est exclue structurellement par
la vue — impossible à faire fuiter par cet appel.

---

## Clé d'accès et permissions

Utiliser la **service_role key** de Supabase, stockée dans les variables d'environnement
du scénario Make. **Jamais la clé `anon`.**

Pourquoi service_role uniquement :
- La vue `rob_providers_catalog_safe` contient des colonnes sensibles (prix_achat,
  prestataire_email, buy_per_pax_extra, etc.) qui ne doivent pas être exposées sans contrôle.
- L'exécution est révoquée de PUBLIC et accordée à service_role uniquement :
  ```sql
  REVOKE EXECUTE ON FUNCTION public.match_providers_catalog(text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.match_providers_catalog(text) TO service_role;
  ```
- service_role bypasse le RLS — comportement attendu pour un accès Make serveur.

---

## Données jamais à envoyer à Claude

La vue exclut structurellement :

| Colonne | Raison |
|---|---|
| `acces_plateforme` | Identifiants et mots de passe plateformes prestataires |

Les colonnes suivantes sont présentes dans le CATALOGUE mais les prompts ont des règles
explicites pour les protéger selon le destinataire :

| Colonne | Visible prestataire (Kensington) | Visible client (Quotes) |
|---|---|---|
| `prix_achat` | Oui (tarif à confirmer) | Non |
| `prix_vente` | Non | Oui (tarif indicatif) |
| `prestataire_email` | Oui (DESTINATAIRE du mail) | Non |
| `buy_per_pax_extra` | Non | Non |
| `conditions_annulation_achat` | Non | Non |
| `supplements_achat` | Non | Non |

Ces règles sont appliquées par les prompts — voir PROMPT_KENSINGTON.md et PROMPT_QUOTES.md,
section "CATALOGUE LIBERTY — UTILISATION".

---

## Codes produit provisoires (non vérifiés vs Kensington Tours)

Les codes suivants ont été inventés lors de l'import faute de code KT connu. Le matching
automatique par `product_code` ne fonctionnera pas dessus tant que les vrais codes KT ne
sont pas identifiés et mis à jour en base :

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
