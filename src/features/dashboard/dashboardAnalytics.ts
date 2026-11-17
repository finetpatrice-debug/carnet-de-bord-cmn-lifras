import type {
  Criterion,
  Evaluation,
  EvaluationScore,
  ExamCode,
  PillarCode,
  Profile,
} from '@/domain/types';
import {
  EXAM_PILLAR_MATRIX,
  OFFICIAL_CRITERIA,
  OFFICIAL_EXAM_TYPES,
} from '@/domain/referentials';
import {
  computePillarCellFromGrades,
  formatScorePercentage,
} from '@/domain/scoringEngine';
import { resolveJuryCell } from '@/features/import/juryNormalizer';

export interface PillarStatusVisuals {
  levelLabel: string;
  strokeColor: string;
  bgBadgeClass: string;
  borderCardClass: string;
  textColorClass: string;
}

/**
 * Code couleur pédagogique réglementaire :
 * - >= 80 % (0.80) : Vert maîtrise
 * - 60-79 % (0.60 .. <0.80) : Bleu/Ambre acquis à consolider
 * - < 60 % (>0 .. <0.60) : Rouge vigilance
 * - 0 (non coté) : Gris ardoise
 */
export function getPillarStatusVisuals(score: number): PillarStatusVisuals {
  if (score <= 0) {
    return {
      levelLabel: 'Non évalué',
      strokeColor: '#94a3b8',
      bgBadgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      borderCardClass: 'border-slate-200 hover:border-slate-300',
      textColorClass: 'text-slate-500',
    };
  }
  if (score >= 0.8) {
    return {
      levelLabel: 'Maîtrise (>= 80 %)',
      strokeColor: '#059669', // emerald-600
      bgBadgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      borderCardClass: 'border-emerald-300 hover:border-emerald-500',
      textColorClass: 'text-emerald-700',
    };
  }
  if (score >= 0.6) {
    return {
      levelLabel: 'Acquis à consolider (60-79 %)',
      strokeColor: '#d97706', // amber-600
      bgBadgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      borderCardClass: 'border-amber-300 hover:border-amber-500',
      textColorClass: 'text-amber-700',
    };
  }
  return {
    levelLabel: 'Vigilance (< 60 %)',
    strokeColor: '#dc2626', // red-600
    bgBadgeClass: 'bg-red-100 text-red-900 border-red-300',
    borderCardClass: 'border-red-300 hover:border-red-500',
    textColorClass: 'text-red-700',
  };
}

export interface ChronologicalPillarPoint {
  evaluationId: string;
  eventDate: string;
  examCode: ExamCode;
  examShortTitle: string;
  evaluatorLabel: string;
  scorePercent: number;
  formattedScore: string;
}

/**
 * Construit la série chronologique des prestations d'un candidat pour un pilier donné
 * en utilisant exclusivement `computePillarCellFromGrades` de `scoringEngine.ts`.
 */
export function buildPillarChronologicalSeries(
  pillarCode: PillarCode,
  candidateEvaluations: Evaluation[],
  allScores: EvaluationScore[],
  criteria: Criterion[] = OFFICIAL_CRITERIA
): ChronologicalPillarPoint[] {
  const published = candidateEvaluations
    .filter(
      (ev) =>
        ev.status === 'PUBLISHED' &&
        EXAM_PILLAR_MATRIX[ev.exam_code].includes(pillarCode)
    )
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  const points: ChronologicalPillarPoint[] = [];

  for (const ev of published) {
    const pillarCriteriaIds = new Set(
      criteria
        .filter(
          (c) =>
            c.exam_code === ev.exam_code &&
            c.pillar_code === pillarCode &&
            c.is_active
        )
        .map((c) => c.id)
    );

    const grades = allScores
      .filter(
        (s) =>
          s.evaluation_id === ev.id && pillarCriteriaIds.has(s.criterion_id)
      )
      .map((s) => s.grade);

    const cell = computePillarCellFromGrades(ev.exam_code, pillarCode, grades);
    if (cell.J > 0) {
      const examTitle =
        OFFICIAL_EXAM_TYPES.find((e) => e.code === ev.exam_code)?.short_title ??
        ev.exam_code;
      points.push({
        evaluationId: ev.id,
        eventDate: ev.event_date,
        examCode: ev.exam_code,
        examShortTitle: examTitle,
        evaluatorLabel: ev.legacy_evaluator_raw ?? 'Jury MN',
        scorePercent: Number((cell.L * 100).toFixed(2)),
        formattedScore: formatScorePercentage(cell.L),
      });
    }
  }

  return points;
}

export interface EvaluatorMatrixRow {
  mnProfile: Profile;
  countsByExam: Record<ExamCode, number>;
  totalForEvaluator: number;
}

export interface EvaluatorCrossMatrix {
  rows: EvaluatorMatrixRow[];
  columnTotals: Record<ExamCode, number>;
  grandTotal: number;
}

/**
 * Construit la Matrice Croisée des Examinateurs :
 * - Lignes = Moniteurs Nationaux normalisés (`mnDirectory`)
 * - Colonnes = les 10 épreuves réglementaires
 * - Totaux marginaux par ligne et par colonne
 */
export function buildEvaluatorCrossMatrix(
  candidateEvaluations: Evaluation[],
  mnDirectory: Profile[]
): EvaluatorCrossMatrix {
  const published = candidateEvaluations.filter(
    (ev) => ev.status === 'PUBLISHED'
  );

  const emptyExamCounts = (): Record<ExamCode, number> => ({
    COURS_MF: 0,
    PEDA_AM_MC: 0,
    FORMATION_MF_REG: 0,
    STAGE_EXPERIENCE: 0,
    TRAVAIL_POLE: 0,
    EXAMEN_THEORIQUE: 0,
    GESTION_DEBAT: 0,
    ORGA_MER: 0,
    ORGA_CARRIERE: 0,
    STAGE_FINAL: 0,
  });

  const rowsByMnId = new Map<string, EvaluatorMatrixRow>();
  for (const mn of mnDirectory) {
    rowsByMnId.set(mn.id, {
      mnProfile: mn,
      countsByExam: emptyExamCounts(),
      totalForEvaluator: 0,
    });
  }

  const columnTotals = emptyExamCounts();
  let grandTotal = 0;

  for (const ev of published) {
    const involvedMnIds = new Set<string>();

    if (ev.lead_evaluator_id && rowsByMnId.has(ev.lead_evaluator_id)) {
      involvedMnIds.add(ev.lead_evaluator_id);
    }

    if (ev.legacy_evaluator_raw) {
      const resolved = resolveJuryCell(ev.legacy_evaluator_raw, mnDirectory);
      for (const match of resolved) {
        if (match.matchedProfileId && rowsByMnId.has(match.matchedProfileId)) {
          involvedMnIds.add(match.matchedProfileId);
        }
      }
    }

    for (const mnId of involvedMnIds) {
      const row = rowsByMnId.get(mnId);
      if (row) {
        row.countsByExam[ev.exam_code] += 1;
        row.totalForEvaluator += 1;
        columnTotals[ev.exam_code] += 1;
        grandTotal += 1;
      }
    }
  }

  return {
    rows: Array.from(rowsByMnId.values()),
    columnTotals,
    grandTotal,
  };
}
