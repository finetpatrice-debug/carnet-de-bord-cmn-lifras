import Dexie, { type Table } from 'dexie';
import type {
  Criterion,
  Evaluation,
  EvaluationScore,
  ExamCode,
  ExamType,
  Profile,
} from '@/domain/types';
import { OFFICIAL_CRITERIA, OFFICIAL_EXAM_TYPES } from '@/domain/referentials';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export interface OutboxEvaluationItem {
  localId?: number;
  id: string; // UUID généré côté client pour idempotence
  candidate_id: string;
  exam_code: ExamCode;
  lead_evaluator_id: string;
  co_evaluator_ids: string[];
  legacy_evaluator_raw: string;
  event_date: string;
  started_at: string;
  submitted_at: string;
  improvements_comment: string;
  strengths_comment: string;
  scores: { criterion_id: number; grade: EvaluationScore['grade'] }[];
  created_at: string;
  sync_status: 'PENDING' | 'SYNCING' | 'FAILED';
  last_error?: string;
}

/**
 * Base de données IndexedDB Offline-First (Dexie.js)
 * Stocke localement :
 * - Les référentiels : `candidates`, `evaluators`, `exam_types`, `criteria`
 * - La boîte d'envoi hors-ligne : `outbox_evaluations`
 */
export class CmnOfflineDatabase extends Dexie {
  candidates!: Table<Profile, string>;
  evaluators!: Table<Profile, string>;
  exam_types!: Table<ExamType, ExamCode>;
  criteria!: Table<Criterion, number>;
  outbox_evaluations!: Table<OutboxEvaluationItem, number>;

  constructor() {
    super('CmnCarnetDeBordOfflineDB');
    this.version(2).stores({
      candidates: 'id, cohort_id, last_name, first_name, club_name',
      evaluators: 'id, last_name, first_name, febras_number',
      exam_types: 'code, display_order',
      criteria: 'id, exam_code, pillar_code, order_in_exam',
      outbox_evaluations:
        '++localId, id, candidate_id, exam_code, sync_status, created_at',
    });
  }
}

export const offlineDb = new CmnOfflineDatabase();

/**
 * Hydrate et synchronise le cache local IndexedDB des 4 référentiels
 * (`candidates`, `evaluators`, `exam_types`, `criteria`).
 */
export async function syncLocalReferentialsCache(
  candidatesList: Profile[],
  evaluatorsList: Profile[]
): Promise<void> {
  await offlineDb.transaction(
    'rw',
    [
      offlineDb.candidates,
      offlineDb.evaluators,
      offlineDb.exam_types,
      offlineDb.criteria,
    ],
    async () => {
      if (candidatesList.length > 0) {
        await offlineDb.candidates.bulkPut(candidatesList);
      }
      if (evaluatorsList.length > 0) {
        await offlineDb.evaluators.bulkPut(evaluatorsList);
      }
      await offlineDb.exam_types.bulkPut(OFFICIAL_EXAM_TYPES);
      await offlineDb.criteria.bulkPut(OFFICIAL_CRITERIA);
    }
  );
}

/**
 * Enregistre une évaluation dans la file d'attente locale `outbox_evaluations`
 * lorsque `navigator.onLine === false` ou si l'appel réseau Supabase échoue.
 */
export async function enqueueOfflineEvaluation(
  item: Omit<OutboxEvaluationItem, 'localId' | 'sync_status'>
): Promise<number> {
  return offlineDb.outbox_evaluations.add({
    ...item,
    sync_status: 'PENDING',
  });
}

/**
 * Tente d'envoyer une évaluation directement vers Supabase (si configuré et en ligne),
 * et bascule automatiquement vers `outbox_evaluations` en cas d'indisponibilité réseau.
 */
export async function submitOrQueueEvaluation(
  payload: Omit<OutboxEvaluationItem, 'localId' | 'sync_status'>,
  options?: {
    forceOffline?: boolean;
    onSyncedToStore?: (data: {
      evaluation: Evaluation;
      scores: EvaluationScore[];
    }) => void;
  }
): Promise<{ mode: 'SYNCED' | 'QUEUED_OFFLINE'; localId?: number }> {
  const isOnline =
    typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!isOnline || options?.forceOffline) {
    const localId = await enqueueOfflineEvaluation(payload);
    return { mode: 'QUEUED_OFFLINE', localId };
  }

  try {
    if (isSupabaseConfigured) {
      const { error: evalErr } = await supabase.from('evaluations').insert({
        id: payload.id,
        legacy_row_id: null,
        candidate_id: payload.candidate_id,
        exam_code: payload.exam_code,
        lead_evaluator_id: payload.lead_evaluator_id,
        legacy_evaluator_raw: payload.legacy_evaluator_raw,
        event_date: payload.event_date,
        started_at: payload.started_at,
        submitted_at: payload.submitted_at,
        improvements_comment: payload.improvements_comment,
        strengths_comment: payload.strengths_comment,
        status: 'PUBLISHED',
      });

      if (evalErr) {
        throw new Error(evalErr.message);
      }

      if (payload.co_evaluator_ids.length > 0) {
        const coRows = payload.co_evaluator_ids.map((coId) => ({
          evaluation_id: payload.id,
          evaluator_id: coId,
        }));
        const { error: coErr } = await supabase
          .from('evaluation_evaluators')
          .insert(coRows);
        if (coErr) {
          throw new Error(coErr.message);
        }
      }

      const scoreRows: EvaluationScore[] = payload.scores.map((s) => ({
        evaluation_id: payload.id,
        criterion_id: s.criterion_id,
        grade: s.grade,
      }));

      const { error: scoresErr } = await supabase
        .from('evaluation_scores')
        .insert(scoreRows);
      if (scoresErr) {
        throw new Error(scoresErr.message);
      }
    }

    const evaluationEntity: Evaluation = {
      id: payload.id,
      legacy_row_id: null,
      candidate_id: payload.candidate_id,
      exam_code: payload.exam_code,
      lead_evaluator_id: payload.lead_evaluator_id,
      legacy_evaluator_raw: payload.legacy_evaluator_raw,
      event_date: payload.event_date,
      started_at: payload.started_at,
      submitted_at: payload.submitted_at,
      improvements_comment: payload.improvements_comment,
      strengths_comment: payload.strengths_comment,
      status: 'PUBLISHED',
      created_at: payload.created_at,
      updated_at: payload.created_at,
    };

    const scoreEntities: EvaluationScore[] = payload.scores.map((s) => ({
      evaluation_id: payload.id,
      criterion_id: s.criterion_id,
      grade: s.grade,
    }));

    options?.onSyncedToStore?.({
      evaluation: evaluationEntity,
      scores: scoreEntities,
    });

    return { mode: 'SYNCED' };
  } catch (err) {
    // En cas d'échec réseau ou serveur Supabase, mise en file d'attente IndexedDB garantie
    const localId = await offlineDb.outbox_evaluations.add({
      ...payload,
      sync_status: 'PENDING',
      last_error: err instanceof Error ? err.message : 'Erreur réseau',
    });
    return { mode: 'QUEUED_OFFLINE', localId };
  }
}

/**
 * Vide et synchronise automatiquement la table `outbox_evaluations` dès le retour du réseau.
 */
export async function flushOutboxEvaluations(
  onItemSynced?: (data: {
    evaluation: Evaluation;
    scores: EvaluationScore[];
  }) => void
): Promise<number> {
  const pendingItems = await offlineDb.outbox_evaluations
    .where('sync_status')
    .anyOf(['PENDING', 'FAILED'])
    .toArray();

  let syncedCount = 0;

  for (const item of pendingItems) {
    if (item.localId === undefined) continue;

    await offlineDb.outbox_evaluations.update(item.localId, {
      sync_status: 'SYNCING',
    });

    try {
      if (isSupabaseConfigured) {
        const { error: evalErr } = await supabase.from('evaluations').insert({
          id: item.id,
          legacy_row_id: null,
          candidate_id: item.candidate_id,
          exam_code: item.exam_code,
          lead_evaluator_id: item.lead_evaluator_id,
          legacy_evaluator_raw: item.legacy_evaluator_raw,
          event_date: item.event_date,
          started_at: item.started_at,
          submitted_at: item.submitted_at,
          improvements_comment: item.improvements_comment,
          strengths_comment: item.strengths_comment,
          status: 'PUBLISHED',
        });

        if (evalErr) throw new Error(evalErr.message);

        if (item.co_evaluator_ids.length > 0) {
          await supabase.from('evaluation_evaluators').insert(
            item.co_evaluator_ids.map((coId) => ({
              evaluation_id: item.id,
              evaluator_id: coId,
            }))
          );
        }

        await supabase.from('evaluation_scores').insert(
          item.scores.map((s) => ({
            evaluation_id: item.id,
            criterion_id: s.criterion_id,
            grade: s.grade,
          }))
        );
      }

      const evaluationEntity: Evaluation = {
        id: item.id,
        legacy_row_id: null,
        candidate_id: item.candidate_id,
        exam_code: item.exam_code,
        lead_evaluator_id: item.lead_evaluator_id,
        legacy_evaluator_raw: item.legacy_evaluator_raw,
        event_date: item.event_date,
        started_at: item.started_at,
        submitted_at: item.submitted_at,
        improvements_comment: item.improvements_comment,
        strengths_comment: item.strengths_comment,
        status: 'PUBLISHED',
        created_at: item.created_at,
        updated_at: new Date().toISOString(),
      };

      const scoreEntities: EvaluationScore[] = item.scores.map((s) => ({
        evaluation_id: item.id,
        criterion_id: s.criterion_id,
        grade: s.grade,
      }));

      onItemSynced?.({ evaluation: evaluationEntity, scores: scoreEntities });
      await offlineDb.outbox_evaluations.delete(item.localId);
      syncedCount += 1;
    } catch (err) {
      await offlineDb.outbox_evaluations.update(item.localId, {
        sync_status: 'FAILED',
        last_error:
          err instanceof Error ? err.message : 'Échec de synchronisation',
      });
    }
  }

  return syncedCount;
}
