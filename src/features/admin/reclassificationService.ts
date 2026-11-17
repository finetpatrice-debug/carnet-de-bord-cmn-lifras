import type {
  AuditLog,
  Criterion,
  Evaluation,
  EvaluationScore,
  ExamCode,
  GradeCode,
} from '@/domain/types';
import { OFFICIAL_CRITERIA } from '@/domain/referentials';
import { computeNameSimilarity } from '@/features/import/juryNormalizer';

export interface CriterionMappingProposal {
  sourceCriterion: Criterion;
  sourceGrade: GradeCode;
  suggestedTargetCriterion: Criterion | null;
  similarityScore: number; // 0 à 1
}

export interface ReclassificationPayload {
  evaluation: Evaluation;
  currentScores: EvaluationScore[];
  targetExamCode: ExamCode;
  mappedTargetGrades: Record<number, GradeCode>; // target_criterion_id -> grade
  actorId: string;
  reason: string;
}

export interface ReclassificationResult {
  updatedEvaluation: Evaluation;
  updatedScores: EvaluationScore[];
  auditLogEntry: AuditLog;
}

/**
 * Propose automatiquement un mapping intelligent entre les critères de l'épreuve source
 * et ceux de l'épreuve cible en croisant :
 * 1. Le même pilier (`pillar_code`)
 * 2. La similarité textuelle de l'intitulé de la question (`question_text`)
 */
export function buildCriterionMappingProposals(
  sourceExamCode: ExamCode,
  targetExamCode: ExamCode,
  sourceScores: EvaluationScore[],
  criteria: Criterion[] = OFFICIAL_CRITERIA
): CriterionMappingProposal[] {
  const sourceCriteria = criteria.filter(
    (c) => c.exam_code === sourceExamCode && c.is_active
  );
  const targetCriteria = criteria.filter(
    (c) => c.exam_code === targetExamCode && c.is_active
  );

  const gradeBySourceCritId = new Map<number, GradeCode>();
  for (const sc of sourceScores) {
    gradeBySourceCritId.set(sc.criterion_id, sc.grade);
  }

  // Calculer toutes les paires (src, tgt) et attribuer par similarité décroissante
  // afin que les critères au libellé identique soient appariés en priorité absolue.
  interface CandidatePair {
    srcId: number;
    tgt: Criterion;
    score: number;
  }

  const allPairs: CandidatePair[] = [];
  for (const srcCrit of sourceCriteria) {
    for (const tgtCrit of targetCriteria) {
      const samePillarBonus =
        tgtCrit.pillar_code === srcCrit.pillar_code ? 0.25 : 0;
      const textSim = computeNameSimilarity(
        srcCrit.question_text,
        tgtCrit.question_text
      );
      const combined = Math.min(1, textSim + samePillarBonus);
      if (combined >= 0.45) {
        allPairs.push({ srcId: srcCrit.id, tgt: tgtCrit, score: combined });
      }
    }
  }

  allPairs.sort((a, b) => b.score - a.score);

  const usedSourceIds = new Set<number>();
  const usedTargetIds = new Set<number>();
  const matchedBySourceId = new Map<
    number,
    { target: Criterion; score: number }
  >();

  for (const pair of allPairs) {
    if (usedSourceIds.has(pair.srcId) || usedTargetIds.has(pair.tgt.id)) {
      continue;
    }
    usedSourceIds.add(pair.srcId);
    usedTargetIds.add(pair.tgt.id);
    matchedBySourceId.set(pair.srcId, {
      target: pair.tgt,
      score: Number(pair.score.toFixed(2)),
    });
  }

  return sourceCriteria.map((srcCrit) => {
    const sourceGrade = gradeBySourceCritId.get(srcCrit.id) ?? 'NE';
    const match = matchedBySourceId.get(srcCrit.id);
    return {
      sourceCriterion: srcCrit,
      sourceGrade,
      suggestedTargetCriterion: match ? match.target : null,
      similarityScore: match ? match.score : 0,
    };
  });
}

/**
 * Exécute le reclassement d'une évaluation mal aiguillée :
 * - Vérifie que le motif obligatoire est renseigné
 * - Met à jour `exam_code` et `updated_at`
 * - Génère les nouveaux `evaluation_scores` pour les critères de l'épreuve cible
 * - Produit l'enregistrement immuable `audit_logs` avec `previous_value` et `new_value` en JSONB
 */
export function executeExamReclassification(
  payload: ReclassificationPayload,
  criteria: Criterion[] = OFFICIAL_CRITERIA
): ReclassificationResult {
  const trimmedReason = payload.reason.trim();
  if (trimmedReason.length < 5) {
    throw new Error(
      'Un motif explicite (minimum 5 caractères) est obligatoire pour journaliser le reclassement dans audit_logs.'
    );
  }

  if (payload.evaluation.exam_code === payload.targetExamCode) {
    throw new Error(
      "L'épreuve cible doit être différente de l'épreuve actuelle."
    );
  }

  const nowIso = new Date().toISOString();
  const targetCriteria = criteria.filter(
    (c) => c.exam_code === payload.targetExamCode && c.is_active
  );

  const updatedEvaluation: Evaluation = {
    ...payload.evaluation,
    exam_code: payload.targetExamCode,
    updated_at: nowIso,
  };

  const updatedScores: EvaluationScore[] = targetCriteria.map((tgtCrit) => ({
    evaluation_id: payload.evaluation.id,
    criterion_id: tgtCrit.id,
    grade: payload.mappedTargetGrades[tgtCrit.id] ?? 'NE',
  }));

  const auditLogEntry: AuditLog = {
    id: crypto.randomUUID ? crypto.randomUUID() : `audit-${Date.now()}`,
    actor_id: payload.actorId,
    entity_type: 'evaluations',
    entity_id: payload.evaluation.id,
    action: 'RECLASSIFY_EXAM_TYPE',
    previous_value: {
      exam_code: payload.evaluation.exam_code,
      scores: payload.currentScores.map((s) => ({
        criterion_id: s.criterion_id,
        grade: s.grade,
      })),
    },
    new_value: {
      exam_code: payload.targetExamCode,
      scores: updatedScores.map((s) => ({
        criterion_id: s.criterion_id,
        grade: s.grade,
      })),
    },
    reason: trimmedReason,
    created_at: nowIso,
  };

  return {
    updatedEvaluation,
    updatedScores,
    auditLogEntry,
  };
}
