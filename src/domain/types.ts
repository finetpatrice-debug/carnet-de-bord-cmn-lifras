/**
 * ============================================================================
 * DOMAINE METIER : TYPES & INTERFACES — CARNET DE BORD DIGITAL CMN (LIFRAS)
 * Strictement aligné sur supabase/migrations/001_init_cmn_schema_and_seed.sql
 * ============================================================================
 */

// 1. Rôles utilisateurs stricts (RGPD & Séparation des rôles — Parrain MN supprimé)
export type UserRole =
  | 'ADMIN_DTF'
  | 'MN_EVALUATOR'
  | 'CMN_CANDIDATE';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN_DTF: 'Administrateur',
  MN_EVALUATOR: 'Moniteur National (MN) Évaluateur',
  CMN_CANDIDATE: 'Candidat Moniteur National (CMN)',
};

// 2. Modes de calcul
export type ScoringMode = 'ISO_EXCEL' | 'WEIGHTED';

// 3. Échelle stricte des cotations (6 paliers numériques : 10, 8, 6, 4, 2, 1 + NE)
export type GradeCode = 'TB' | 'B' | 'S' | 'I' | 'M' | '1' | 'NE';

export const GRADE_POINTS: Record<Exclude<GradeCode, 'NE'>, number> = {
  TB: 10,
  B: 8,
  S: 6,
  I: 4,
  M: 2,
  '1': 1,
};

export const GRADE_LABELS: Record<GradeCode, string> = {
  TB: '10',
  B: '8',
  S: '6',
  I: '4',
  M: '2',
  '1': '1',
  NE: 'NE',
};

// 4. Codes des 5 Piliers de compétences du Moniteur National
export type PillarCode =
  | 'LEADERSHIP'
  | 'FORMATEUR'
  | 'CONCEPTION'
  | 'CONNAISSANCES'
  | 'ORGANISATEUR';

// 5. Codes des 11 Épreuves réglementaires du cursus CMN (incluant Directeur de plongée)
export type ExamCode =
  | 'COURS_MF'
  | 'PEDA_AM_MC'
  | 'FORMATION_MF_REG'
  | 'STAGE_EXPERIENCE'
  | 'TRAVAIL_POLE'
  | 'EXAMEN_THEORIQUE'
  | 'GESTION_DEBAT'
  | 'ORGA_MER'
  | 'ORGA_CARRIERE'
  | 'DIRECTEUR_PLONGEE'
  | 'STAGE_FINAL';

// 6. Statut logique d'une évaluation (Aucune suppression physique)
export type EvaluationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

// ============================================================================
// ENTITES DU SCHEMA RELATIONNEL (TABLES SUPABASE)
// ============================================================================

/** Table 1 : cohorts */
export interface Cohort {
  id: string;
  code: string;
  label: string;
  scoring_mode: ScoringMode;
  is_active: boolean;
  created_at: string;
}

/** Table 2 : profiles (Fiche Signalétique complète, numéros tel/FEBRAS en TEXT) */
export interface Profile {
  id: string;
  role: UserRole;
  cohort_id: string | null;
  sponsor_mn_id: string | null;
  last_name: string;
  first_name: string;
  birth_date: string | null;
  street_address: string | null;
  postal_code: string | null;
  city: string | null;
  phone_landline: string | null;
  phone_gsm: string | null;
  email: string;
  febras_number: string | null;
  cfps_year: number | null;
  mf_year: number | null;
  dives_count: number | null;
  club_name: string | null;
  club_president: string | null;
  club_head_instructor: string | null;
  club_head_gsm: string | null;
  photo_storage_path: string | null;
  aliases: string[];
  created_at: string;
  updated_at: string;
}

/** Table 3 : pillars */
export interface Pillar {
  code: PillarCode;
  title: string;
  official_description: string;
  display_order: number;
}

/** Table 4 : exam_types */
export interface ExamType {
  code: ExamCode;
  short_title: string;
  forms_label: string;
  display_order: number;
}

/** Table 5 : criteria (99 critères mappés sur les colonnes I à DC d'Excel) */
export interface Criterion {
  id: number;
  excel_col: string;
  exam_code: ExamCode;
  pillar_code: PillarCode;
  order_in_exam: number;
  question_text: string;
  is_active: boolean;
}

/** Table 6 : evaluations */
export interface Evaluation {
  id: string;
  legacy_row_id: number | null;
  candidate_id: string;
  exam_code: ExamCode;
  lead_evaluator_id: string | null;
  legacy_evaluator_raw: string | null;
  event_date: string;
  started_at: string | null;
  submitted_at: string | null;
  improvements_comment: string; // Colonne DD : Ce que le CMN doit améliorer
  strengths_comment: string;    // Colonne DE : Ce que le CMN doit garder
  status: EvaluationStatus;
  created_at: string;
  updated_at: string;
}

/** Table 7 : evaluation_evaluators (Co-examinateurs) */
export interface EvaluationEvaluator {
  evaluation_id: string;
  evaluator_id: string;
}

/** Table 8 : evaluation_scores (Cotations unitaires par critère) */
export interface EvaluationScore {
  evaluation_id: string;
  criterion_id: number;
  grade: GradeCode;
}

/** Table 9 : audit_logs (Journal d'audit immuable) */
export interface AuditLog {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string;
  created_at: string;
}

// ============================================================================
// STRUCTURES POUR LE MOTEUR DE CALCUL ISO-EXCEL (scoringEngine.ts)
// ============================================================================

export interface PillarExamScoreResult {
  pillarCode: PillarCode;
  examCode: ExamCode;
  totalPoints: number;
  validCount: number;
  /** Score entre 0 et 1. Vaut 0 si validCount === 0 (état non coté) */
  score: number;
  /** Pourcentage formaté à 2 décimales ou "Non évalué" si validCount === 0 */
  formattedPercentage: string;
}

export interface ExamAverageResult {
  examCode: ExamCode;
  pillarScores: Record<PillarCode, number>;
  /** Moyenne arithmétique des piliers > 0, ou null si aucun pilier > 0 */
  average: number | null;
  /** Affiché en % à 2 décimales ou "Non évalué" (jamais #DIV/0! ni NaN) */
  formattedAverage: string;
}

export interface GlobalPillarAverageResult {
  pillarCode: PillarCode;
  evaluatedExamsCount: number;
  /** Moyenne arithmétique non pondérée des scores > 0 du pilier à travers les épreuves */
  average: number | null;
  formattedAverage: string;
}

// ============================================================================
// DEFINITION DU SCHEMA SUPABASE TYPÉ (Database Generic Type)
// ============================================================================

export interface Database {
  public: {
    Tables: {
      cohorts: {
        Row: Cohort;
        Insert: Omit<Cohort, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Cohort, 'id' | 'created_at'>>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at' | 'aliases'> & {
          aliases?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
        Relationships: [];
      };
      pillars: {
        Row: Pillar;
        Insert: Pillar;
        Update: Partial<Pillar>;
        Relationships: [];
      };
      exam_types: {
        Row: ExamType;
        Insert: ExamType;
        Update: Partial<ExamType>;
        Relationships: [];
      };
      criteria: {
        Row: Criterion;
        Insert: Omit<Criterion, 'is_active'> & { is_active?: boolean };
        Update: Partial<Criterion>;
        Relationships: [];
      };
      evaluations: {
        Row: Evaluation;
        Insert: Omit<Evaluation, 'id' | 'created_at' | 'updated_at' | 'status' | 'improvements_comment' | 'strengths_comment'> & {
          id?: string;
          status?: EvaluationStatus;
          improvements_comment?: string;
          strengths_comment?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Evaluation, 'id' | 'created_at'>>;
        Relationships: [];
      };
      evaluation_evaluators: {
        Row: EvaluationEvaluator;
        Insert: EvaluationEvaluator;
        Update: Partial<EvaluationEvaluator>;
        Relationships: [];
      };
      evaluation_scores: {
        Row: EvaluationScore;
        Insert: EvaluationScore;
        Update: Partial<EvaluationScore>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: never; // Journal immuable
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
