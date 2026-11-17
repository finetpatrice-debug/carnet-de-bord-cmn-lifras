/**
 * ============================================================================
 * MOTEUR MATHEMATIQUE PUR « ISO-EXCEL » — CARNET DE BORD DIGITAL CMN (LIFRAS)
 * Strictement conforme aux directives d'architecture et au Sprint 2.
 * Aucune agrégation de notes ne doit être codée en dehors de ce module.
 * ============================================================================
 */

import type {
  Criterion,
  Evaluation,
  EvaluationScore,
  ExamAverageResult,
  ExamCode,
  GlobalPillarAverageResult,
  GradeCode,
  PillarCode,
  PillarExamScoreResult,
  ScoringMode,
} from './types';
import { EXAM_PILLAR_MATRIX, OFFICIAL_EXAM_TYPES, OFFICIAL_PILLARS } from './referentials';

/**
 * 1. Barème officiel strict :
 * TB = 10, B = 8, S = 6, I = 4, M = 2.
 * La note NE est comptabilisée dans la distribution statistique (counts.NE),
 * mais ignorée dans la somme pondérée K et dans le total des items cotés J.
 */
export const GRADE_WEIGHTS: Record<Exclude<GradeCode, 'NE'>, number> = {
  TB: 10,
  B: 8,
  S: 6,
  I: 4,
  M: 2,
};

export interface GradeDistributionCounts {
  TB: number;
  B: number;
  S: number;
  I: number;
  M: number;
  NE: number;
}

export interface PillarCellComputation {
  examCode: ExamCode;
  pillarCode: PillarCode;
  counts: GradeDistributionCounts;
  /** J = n_TB + n_B + n_S + n_I + n_M (NE exclu du dénominateur) */
  J: number;
  /** K = 10*n_TB + 8*n_B + 6*n_S + 4*n_I + 2*n_M */
  K: number;
  /** L = J > 0 ? (K / J) / 10 : 0  (équivalent exact de =IFERROR(K/J, 0)/10) */
  L: number;
  formattedScore: string;
}

export interface ExamComputationSummary {
  examCode: ExamCode;
  /** Nombre d'enregistrements evaluations PUBLISHED pour cette épreuve */
  evaluationCount: number;
  /** Détail mathématique (counts, J, K, L) par pilier rattaché à l'épreuve */
  pillars: Partial<Record<PillarCode, PillarCellComputation>>;
  /** Moyenne arithmétique simple des piliers dont L > 0, ou null si aucun L > 0 */
  examAverage: number | null;
  /** Affichage formaté ("XX,XX %" ou "Non évalué") */
  formattedExamAverage: string;
}

export interface CandidateScoreboardResult {
  scoringMode: ScoringMode;
  totalPublishedEvaluations: number;
  exams: Record<ExamCode, ExamComputationSummary>;
  globalPillarScores: Record<PillarCode, number>;
  formattedGlobalPillarScores: Record<PillarCode, string>;
}

/**
 * Crée un objet de comptage vierge pour une cellule (exam_code, pillar_code).
 */
export function createEmptyGradeCounts(): GradeDistributionCounts {
  return { TB: 0, B: 0, S: 0, I: 0, M: 0, NE: 0 };
}

/**
 * Formate un score compris entre 0 et 1 en pourcentage français à 2 décimales,
 * ou retourne "Non évalué" si le score est null, NaN ou <= 0.
 */
export function formatScorePercentage(score: number | null): string {
  if (score === null || Number.isNaN(score) || score <= 0) {
    return 'Non évalué';
  }
  return `${(score * 100).toFixed(2).replace('.', ',')} %`;
}

/**
 * 2. Calcule les indicateurs exacts J, K, L pour un couple (exam_code, pillar_code)
 * à partir de la distribution des notes (n_TB, n_B, n_S, n_I, n_M, n_NE).
 *
 * - J = n_TB + n_B + n_S + n_I + n_M
 * - K = 10*n_TB + 8*n_B + 6*n_S + 4*n_I + 2*n_M
 * - L = J > 0 ? (K / J) / 10 : 0
 */
export function computePillarCellFromCounts(
  examCode: ExamCode,
  pillarCode: PillarCode,
  countsInput: Partial<GradeDistributionCounts>
): PillarCellComputation {
  const counts: GradeDistributionCounts = {
    TB: countsInput.TB ?? 0,
    B: countsInput.B ?? 0,
    S: countsInput.S ?? 0,
    I: countsInput.I ?? 0,
    M: countsInput.M ?? 0,
    NE: countsInput.NE ?? 0,
  };

  const J = counts.TB + counts.B + counts.S + counts.I + counts.M;
  const K =
    GRADE_WEIGHTS.TB * counts.TB +
    GRADE_WEIGHTS.B * counts.B +
    GRADE_WEIGHTS.S * counts.S +
    GRADE_WEIGHTS.I * counts.I +
    GRADE_WEIGHTS.M * counts.M;

  const L = J > 0 ? K / J / 10 : 0;

  return {
    examCode,
    pillarCode,
    counts,
    J,
    K,
    L,
    formattedScore: J > 0 ? formatScorePercentage(L) : 'Non évalué',
  };
}

/**
 * Calcule la cellule (exam_code, pillar_code) à partir d'une liste brute de notes GradeCode[].
 */
export function computePillarCellFromGrades(
  examCode: ExamCode,
  pillarCode: PillarCode,
  grades: GradeCode[]
): PillarCellComputation {
  const counts = createEmptyGradeCounts();
  for (const grade of grades) {
    counts[grade] += 1;
  }
  return computePillarCellFromCounts(examCode, pillarCode, counts);
}

/**
 * 3. Moyenne par épreuve `examAverage` :
 * - Prend tous les piliers de l'épreuve dont `L > 0`.
 * - S'il en existe au moins un, retourne leur moyenne arithmétique simple
 *   (équivalent exact de `=AVERAGEIF(L_start:L_end, ">0")`).
 * - S'il n'en existe aucun (ex: Stage Final à 0 évaluation ou uniquement des NE),
 *   retourne `null` (et jamais `NaN` ni erreur `#DIV/0!`).
 */
export function computeExamAverageFromPillarCells(
  pillarCells: Partial<Record<PillarCode, PillarCellComputation>>
): number | null {
  const activePillars = Object.values(pillarCells).filter(
    (cell): cell is PillarCellComputation => cell !== undefined && cell.L > 0
  );

  if (activePillars.length === 0) {
    return null;
  }

  const sumL = activePillars.reduce((acc, cell) => acc + cell.L, 0);
  return sumL / activePillars.length;
}

/**
 * 5. Moyenne globale par pilier `globalPillarScore` (les 5 tuiles du Tableau de Bord) :
 * - Mode 'ISO_EXCEL' (par défaut) :
 *   Récupère la liste des valeurs L de toutes les épreuves qui comportent ce pilier,
 *   filtre uniquement les valeurs L > 0 et calcule leur moyenne arithmétique simple
 *   non pondérée (équivalent exact de `=IFERROR(AVERAGEIF(Q_start:Q_end, "<>0"), 0)`).
 * - Mode 'WEIGHTED' (optionnel, désactivé par défaut) :
 *   Variante pondérée par le nombre réel d'évaluations publiées (`evaluationCount`)
 *   de chaque épreuve où `L > 0`.
 */
export function computeGlobalPillarScore(
  pillarCode: PillarCode,
  examsSummary: Record<ExamCode, ExamComputationSummary>,
  scoringMode: ScoringMode = 'ISO_EXCEL'
): number {
  const entriesWithPositiveL: { L: number; evaluationCount: number }[] = [];

  for (const exam of OFFICIAL_EXAM_TYPES) {
    const examSummary = examsSummary[exam.code];
    if (!examSummary) continue;

    const cell = examSummary.pillars[pillarCode];
    if (cell && cell.L > 0) {
      entriesWithPositiveL.push({
        L: cell.L,
        evaluationCount: examSummary.evaluationCount,
      });
    }
  }

  if (entriesWithPositiveL.length === 0) {
    return 0;
  }

  if (scoringMode === 'WEIGHTED') {
    const totalWeight = entriesWithPositiveL.reduce(
      (acc, item) => acc + item.evaluationCount,
      0
    );
    if (totalWeight <= 0) {
      return 0;
    }
    const weightedSum = entriesWithPositiveL.reduce(
      (acc, item) => acc + item.L * item.evaluationCount,
      0
    );
    return weightedSum / totalWeight;
  }

  // Mode ISO_EXCEL par défaut : moyenne arithmétique simple non pondérée
  const sumL = entriesWithPositiveL.reduce((acc, item) => acc + item.L, 0);
  return sumL / entriesWithPositiveL.length;
}

/**
 * Structure d'entrée permettant d'injecter directement une matrice de distributions
 * par épreuve et par pilier (ex: Golden Dataset ou agrégat pré-calculé).
 */
export interface DirectExamDistributionsInput {
  evaluationCount: number;
  pillars: Partial<Record<PillarCode, Partial<GradeDistributionCounts>>>;
}

/**
 * Calcule l'intégralité du Tableau de Bord d'un candidat à partir des distributions
 * de notes par couple (exam_code, pillar_code).
 */
export function computeScoreboardFromDistributions(
  distributions: Partial<Record<ExamCode, DirectExamDistributionsInput>>,
  scoringMode: ScoringMode = 'ISO_EXCEL'
): CandidateScoreboardResult {
  const exams = {} as Record<ExamCode, ExamComputationSummary>;
  let totalPublishedEvaluations = 0;

  for (const examMeta of OFFICIAL_EXAM_TYPES) {
    const examCode = examMeta.code;
    const examInput = distributions[examCode];
    const evaluationCount = examInput?.evaluationCount ?? 0;
    totalPublishedEvaluations += evaluationCount;

    const attachedPillars = EXAM_PILLAR_MATRIX[examCode];
    const pillarCells: Partial<Record<PillarCode, PillarCellComputation>> = {};

    for (const pillarCode of attachedPillars) {
      const countsForPillar = examInput?.pillars?.[pillarCode] ?? createEmptyGradeCounts();
      pillarCells[pillarCode] = computePillarCellFromCounts(
        examCode,
        pillarCode,
        countsForPillar
      );
    }

    const examAverage = computeExamAverageFromPillarCells(pillarCells);

    exams[examCode] = {
      examCode,
      evaluationCount,
      pillars: pillarCells,
      examAverage,
      formattedExamAverage: formatScorePercentage(examAverage),
    };
  }

  const globalPillarScores = {} as Record<PillarCode, number>;
  const formattedGlobalPillarScores = {} as Record<PillarCode, string>;

  for (const pillarMeta of OFFICIAL_PILLARS) {
    const pCode = pillarMeta.code;
    const gScore = computeGlobalPillarScore(pCode, exams, scoringMode);
    globalPillarScores[pCode] = gScore;
    formattedGlobalPillarScores[pCode] = formatScorePercentage(gScore);
  }

  return {
    scoringMode,
    totalPublishedEvaluations,
    exams,
    globalPillarScores,
    formattedGlobalPillarScores,
  };
}

/**
 * Calcule l'intégralité du Tableau de Bord d'un candidat à partir des entités
 * relationnelles Supabase (`evaluations` PUBLISHED, `evaluation_scores` et `criteria`).
 *
 * - Règle 4 : `evaluationCount` compte directement le nombre d'enregistrements
 *   `evaluations` publiés pour chaque épreuve.
 */
export function computeCandidateScoreboard(
  evaluations: Pick<Evaluation, 'id' | 'exam_code' | 'status'>[],
  evaluationScores: EvaluationScore[],
  criteria: Criterion[],
  scoringMode: ScoringMode = 'ISO_EXCEL'
): CandidateScoreboardResult {
  // 1. Filtrer uniquement les évaluations PUBLISHED
  const publishedEvaluations = evaluations.filter(
    (ev) => ev.status === 'PUBLISHED'
  );

  const publishedEvalById = new Map<string, ExamCode>();
  const evalCountByExam = new Map<ExamCode, number>();

  for (const ev of publishedEvaluations) {
    publishedEvalById.set(ev.id, ev.exam_code);
    evalCountByExam.set(
      ev.exam_code,
      (evalCountByExam.get(ev.exam_code) ?? 0) + 1
    );
  }

  // 2. Indexer les critères actifs par ID
  const criterionById = new Map<number, Criterion>();
  for (const crit of criteria) {
    if (crit.is_active) {
      criterionById.set(crit.id, crit);
    }
  }

  // 3. Initialiser la matrice de distributions pour chaque épreuve
  const distributions: Partial<Record<ExamCode, DirectExamDistributionsInput>> = {};
  for (const examMeta of OFFICIAL_EXAM_TYPES) {
    const examCode = examMeta.code;
    const pillarsMap: Partial<Record<PillarCode, GradeDistributionCounts>> = {};
    for (const pCode of EXAM_PILLAR_MATRIX[examCode]) {
      pillarsMap[pCode] = createEmptyGradeCounts();
    }
    distributions[examCode] = {
      evaluationCount: evalCountByExam.get(examCode) ?? 0,
      pillars: pillarsMap,
    };
  }

  // 4. Parcourir les cotations unitaires rattachées aux évaluations PUBLISHED
  for (const scoreRow of evaluationScores) {
    const evalExamCode = publishedEvalById.get(scoreRow.evaluation_id);
    if (!evalExamCode) continue;

    const criterion = criterionById.get(scoreRow.criterion_id);
    if (!criterion || criterion.exam_code !== evalExamCode) continue;

    const examDist = distributions[evalExamCode];
    if (!examDist) continue;

    const pillarCounts = examDist.pillars[criterion.pillar_code];
    if (!pillarCounts) continue;

    pillarCounts[scoreRow.grade] = (pillarCounts[scoreRow.grade] ?? 0) + 1;
  }

  return computeScoreboardFromDistributions(distributions, scoringMode);
}

// ============================================================================
// FONCTIONS UTILITAIRES DE COMPATIBILITE POUR LES COMPOSANTS UI
// ============================================================================

export function computePillarScoreInExam(
  examCode: ExamCode,
  pillarCode: PillarCode,
  grades: GradeCode[]
): PillarExamScoreResult {
  const cell = computePillarCellFromGrades(examCode, pillarCode, grades);
  return {
    pillarCode,
    examCode,
    totalPoints: cell.K,
    validCount: cell.J,
    score: cell.L,
    formattedPercentage: cell.formattedScore,
  };
}

export function computeExamAverage(
  examCode: ExamCode,
  criteriaForExam: Criterion[],
  scores: EvaluationScore[]
): ExamAverageResult {
  const scoreByCriterion = new Map<number, GradeCode>();
  for (const s of scores) {
    scoreByCriterion.set(s.criterion_id, s.grade);
  }

  const pillarCells: Partial<Record<PillarCode, PillarCellComputation>> = {};
  const pillarScores: Record<PillarCode, number> = {
    LEADERSHIP: 0,
    FORMATEUR: 0,
    CONCEPTION: 0,
    CONNAISSANCES: 0,
    ORGANISATEUR: 0,
  };

  for (const pillar of EXAM_PILLAR_MATRIX[examCode]) {
    const pillarCriteria = criteriaForExam.filter(
      (c) => c.exam_code === examCode && c.pillar_code === pillar && c.is_active
    );
    const grades: GradeCode[] = pillarCriteria.map(
      (c) => scoreByCriterion.get(c.id) ?? 'NE'
    );
    const cell = computePillarCellFromGrades(examCode, pillar, grades);
    pillarCells[pillar] = cell;
    pillarScores[pillar] = cell.L;
  }

  const average = computeExamAverageFromPillarCells(pillarCells);

  return {
    examCode,
    pillarScores,
    average,
    formattedAverage: formatScorePercentage(average),
  };
}

export function computeGlobalPillarAverage(
  pillarCode: PillarCode,
  pillarScoresAcrossExams: number[]
): GlobalPillarAverageResult {
  const positiveScores = pillarScoresAcrossExams.filter((s) => s > 0);
  const evaluatedExamsCount = positiveScores.length;
  const average =
    evaluatedExamsCount === 0
      ? null
      : positiveScores.reduce((acc, v) => acc + v, 0) / evaluatedExamsCount;

  return {
    pillarCode,
    evaluatedExamsCount,
    average,
    formattedAverage: formatScorePercentage(average),
  };
}
