# Directives d'Architecture — Carnet de Bord Digital CMN (LIFRAS)

## 1. Stack Technique Obligatoire
- Frontend : React 19, TypeScript (mode strict, aucun `any`), Vite, Tailwind CSS, Shadcn/UI, Lucide Icons, Recharts.
- Mode Offline PWA : `vite-plugin-pwa` + `dexie` (IndexedDB) pour mise en file d'attente hors-ligne des évaluations terrain.
- Backend & BDD : Supabase (PostgreSQL 16, Auth, Storage privé, Row-Level Security activé sur 100 % des tables).
- Tests : Vitest pour la certification mathématique du moteur de calcul.
- Langue de l'interface : Français exclusivement.

## 2. Invariants Métier & Moteur « Iso-Excel »
- Échelle stricte des cotations : `TB` = 10, `B` = 8, `S` = 6, `I` = 4, `M` = 2.
- La mention `NE` (Non Évalué) vaut 0 au numérateur et est EXCLUE du dénominateur (`J`).
- Interdiction absolue de calculer des moyennes dans les composants React ou en SQL brut non testé : toute agrégation passe par `src/domain/scoringEngine.ts`.
- En mode `ISO_EXCEL` :
  1. Le score d'un pilier au sein d'une épreuve vaut `SommePoints / (10 * NbItemsCotesValides)` (exprimé entre 0 et 1, affiché en pourcentage à 2 décimales). Si `NbItemsCotesValides === 0`, le score vaut `0` (état non coté).
  2. La moyenne d'une épreuve est la moyenne arithmétique simple des piliers de cette épreuve ayant un score `> 0`. Si aucun pilier n'a un score `> 0`, retourner `null` et afficher `"Non évalué"` (jamais `#DIV/0!` ni `NaN`).
  3. La moyenne globale d'un pilier (tuiles du Tableau de Bord) est la moyenne arithmétique simple non pondérée des scores `> 0` de ce pilier à travers les épreuves rattachées.

## 3. Intégrité des Données & RGPD
- Les numéros de téléphone/GSM et numéros matricules FEBRAS sont stockés en `TEXT` (préservation du zéro initial).
- Aucune suppression physique d'évaluation publiée : utiliser un statut logique et journaliser tout reclassement d'épreuve dans `audit_logs`.
- Séparation stricte des rôles : `ADMIN_DTF`, `MN_EVALUATOR`, `PARRAIN_MN`, `CMN_CANDIDATE`.
