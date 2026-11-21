import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/services/supabaseClient';
import type {
  AuditLog,
  Evaluation,
  EvaluationScore,
  Profile,
} from '@/domain/types';
import {
  buildSampleGoldenWorkbookBuffer,
  parseCmnExcelWorkbook,
} from '@/features/import/excelImporter';
import {
  JENNYFER_VERHOEVEN_EVALUATIONS,
  JENNYFER_VERHOEVEN_SCORES,
} from './jennyferVerhoevenDataset';
import {
  VALERIE_GASPAR_EVALUATIONS,
  VALERIE_GASPAR_SCORES,
} from './valerieGasparDataset';
import { OFFICIAL_MN_DIRECTORY_PROFILES } from './officialMnDirectory';

interface AdminStoreContextValue {
  mnDirectory: Profile[];
  candidates: Profile[];
  evaluations: Evaluation[];
  evaluationScores: EvaluationScore[];
  auditLogs: AuditLog[];
  archivedProfiles: Profile[];
  addAliasToMn: (mnProfileId: string, alias: string) => void;
  importCandidateWorkbookData: (payload: {
    candidateProfile: Profile;
    newEvaluations: Evaluation[];
    newScores: EvaluationScore[];
    auditLog: AuditLog;
  }) => void;
  applyReclassification: (payload: {
    updatedEvaluation: Evaluation;
    updatedScores: EvaluationScore[];
    auditLogEntry: AuditLog;
  }) => void;
  recordFieldEvaluation: (payload: {
    evaluation: Evaluation;
    scores: EvaluationScore[];
  }) => void;
  createCandidateProfile: (payload: {
    candidateProfile: Profile;
    auditLog: AuditLog;
  }) => void;
  updateProfileRole: (
    profileId: string,
    newRole: Profile['role'],
    actorId: string
  ) => void;
  updateFullProfile: (updated: Profile, actorId: string) => void;
  deleteProfile: (profileId: string, actorId: string) => void;
  restoreProfile: (profileId: string, actorEmail: string, actorId: string) => void;
  purgeArchivedProfile: (profileId: string, actorEmail: string, actorId: string) => void;
  clearAuditLogs: (actorEmail: string, actorId: string) => void;
  syncWithCloudNow: () => Promise<{ evaluationsCount: number; synced: boolean }>;
}

export const CREATOR_EMAILS = [
  'patricefinet@lifras.be',
  'patrice.finet@lifras.be',
] as const;

export const CREATOR_USER_ID = '23902f14-3dd7-4325-a204-babcac09086d';

export function isCreatorAccount(
  email?: string | null,
  userId?: string | null
): boolean {
  const normalized = (email ?? '').trim().toLowerCase();
  if (
    CREATOR_EMAILS.includes(normalized as (typeof CREATOR_EMAILS)[number])
  ) {
    return true;
  }
  return Boolean(userId && userId === CREATOR_USER_ID);
}

const INITIAL_MN_DIRECTORY: Profile[] = [
  {
    id: 'mn-001',
    role: 'MN_EVALUATOR',
    cohort_id: 'cohort-2026',
    sponsor_mn_id: null,
    last_name: 'Lambert',
    first_name: 'Jean-Marc',
    birth_date: '1978-09-21',
    street_address: 'Rue du Récif 14',
    postal_code: '4000',
    city: 'Liège',
    phone_landline: null,
    phone_gsm: '0475987654',
    email: 'jm.lambert@lifras.be',
    febras_number: '0023456',
    cfps_year: 2008,
    mf_year: 2011,
    dives_count: 1420,
    club_name: 'CAS Liège',
    club_president: null,
    club_head_instructor: null,
    club_head_gsm: null,
    photo_storage_path: null,
    aliases: ['J-M Lambert', 'JM Lambert', 'Lambert J-M'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mn-002',
    role: 'MN_EVALUATOR',
    cohort_id: 'cohort-2026',
    sponsor_mn_id: null,
    last_name: 'Dubois',
    first_name: 'Claire',
    birth_date: '1980-02-18',
    street_address: 'Chaussée des Carrières 8',
    postal_code: '5000',
    city: 'Namur',
    phone_landline: null,
    phone_gsm: '0472112233',
    email: 'claire.dubois@lifras.be',
    febras_number: '0034567',
    cfps_year: 2010,
    mf_year: 2013,
    dives_count: 1150,
    club_name: 'Namur Plongée',
    club_president: null,
    club_head_instructor: null,
    club_head_gsm: null,
    photo_storage_path: null,
    aliases: ['C. Dubois'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mn-003',
    role: 'MN_EVALUATOR',
    cohort_id: 'cohort-2026',
    sponsor_mn_id: null,
    last_name: 'Hendrickx',
    first_name: 'Philippe',
    birth_date: '1974-11-03',
    street_address: 'Avenue de la Mer 22',
    postal_code: '1200',
    city: 'Bruxelles',
    phone_landline: null,
    phone_gsm: '0476554433',
    email: 'p.hendrickx@lifras.be',
    febras_number: '0019876',
    cfps_year: 2004,
    mf_year: 2007,
    dives_count: 1680,
    club_name: 'EPB Bruxelles',
    club_president: null,
    club_head_instructor: null,
    club_head_gsm: null,
    photo_storage_path: null,
    aliases: ['Ph. Hendrickx', 'Hendrickx Ph.'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mn-004',
    role: 'MN_EVALUATOR',
    cohort_id: 'cohort-2026',
    sponsor_mn_id: null,
    last_name: 'Vandevelde',
    first_name: 'Marc',
    birth_date: '1972-07-14',
    street_address: 'Rue du Lac 5',
    postal_code: '1300',
    city: 'Wavre',
    phone_landline: null,
    phone_gsm: '0478223344',
    email: 'm.vandevelde@lifras.be',
    febras_number: '0011223',
    cfps_year: 2002,
    mf_year: 2005,
    dives_count: 2100,
    club_name: 'Nautilus Club',
    club_president: null,
    club_head_instructor: null,
    club_head_gsm: null,
    photo_storage_path: null,
    aliases: ['M. Vandevelde'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mn-005',
    role: 'MN_EVALUATOR',
    cohort_id: 'cohort-2026',
    sponsor_mn_id: null,
    last_name: 'Moreau',
    first_name: 'Luc',
    birth_date: '1979-03-29',
    street_address: 'Rue des Plongeurs 9',
    postal_code: '6000',
    city: 'Charleroi',
    phone_landline: null,
    phone_gsm: '0471009988',
    email: 'luc.moreau@lifras.be',
    febras_number: '0044556',
    cfps_year: 2009,
    mf_year: 2012,
    dives_count: 1300,
    club_name: 'Nautilus Club',
    club_president: null,
    club_head_instructor: null,
    club_head_gsm: null,
    photo_storage_path: null,
    aliases: ['L. Moreau'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mn-xavier-doutrepont',
    role: 'MN_EVALUATOR',
    cohort_id: 'cohort-2026',
    sponsor_mn_id: null,
    last_name: 'Doutrepont',
    first_name: 'Xavier',
    birth_date: null,
    street_address: null,
    postal_code: null,
    city: null,
    phone_landline: null,
    phone_gsm: '0475000000',
    email: 'xavierdoutrepont@gmail.com',
    febras_number: '0015000',
    cfps_year: 2006,
    mf_year: 2010,
    dives_count: 1500,
    club_name: 'CE LIFRAS',
    club_president: null,
    club_head_instructor: null,
    club_head_gsm: null,
    photo_storage_path: null,
    aliases: ['Xavier Doutrepont', 'X. Doutrepont', 'Doutrepont', 'doutrepont'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  ...OFFICIAL_MN_DIRECTORY_PROFILES,
];

const INITIAL_CANDIDATES: Profile[] = [
  {
    id: 'cand-jennyfer-verhoeven',
    role: 'CMN_CANDIDATE',
    cohort_id: 'cohort-2026',
    sponsor_mn_id: null,
    last_name: 'Verhoeven',
    first_name: 'Jennyfer',
    birth_date: null,
    street_address: null,
    postal_code: null,
    city: null,
    phone_landline: null,
    phone_gsm: '0476123456',
    email: 'jennyfer.verhoeven@lifras.be',
    febras_number: '0059876',
    cfps_year: 2019,
    mf_year: 2022,
    dives_count: 720,
    club_name: 'CFIP / LIFRAS',
    club_president: null,
    club_head_instructor: null,
    club_head_gsm: null,
    photo_storage_path: null,
    aliases: ['Verhoeven Jennyfer', 'VERHOEVEN Jennyfer'],
    created_at: '2026-01-05T00:00:00Z',
    updated_at: '2026-01-05T00:00:00Z',
  },
  {
    id: 'cand-valerie-gaspar',
    role: 'CMN_CANDIDATE',
    cohort_id: 'cohort-2026',
    sponsor_mn_id: null,
    last_name: 'Gaspar',
    first_name: 'Valérie',
    birth_date: '1982-06-30',
    street_address: "Rue D'orgeo 24",
    postal_code: '6880',
    city: 'Bertrix',
    phone_landline: null,
    phone_gsm: '0479538534',
    email: 'vg@geometric.be',
    febras_number: '51786',
    cfps_year: 2017,
    mf_year: 2021,
    dives_count: 1160,
    club_name: 'RCAS',
    club_president: 'Sylvie Glautier',
    club_head_instructor: 'Johan Maes',
    club_head_gsm: null,
    photo_storage_path: null,
    aliases: ['Gaspar Valérie', 'GASPAR Valérie'],
    created_at: '2026-01-08T00:00:00Z',
    updated_at: '2026-01-08T00:00:00Z',
  },
  {
    id: 'cand-thomas-peeters',
    role: 'CMN_CANDIDATE',
    cohort_id: 'cohort-2026',
    sponsor_mn_id: 'mn-002',
    last_name: 'Peeters',
    first_name: 'Thomas',
    birth_date: '1988-06-30',
    street_address: 'Rue de la Zélande 42',
    postal_code: '1300',
    city: 'Wavre',
    phone_landline: '010223344',
    phone_gsm: '0479445566',
    email: 'thomas.peeters@lifras.be',
    febras_number: '0054321',
    cfps_year: 2018,
    mf_year: 2021,
    dives_count: 640,
    club_name: 'Nautilus Club',
    club_president: 'Marc Vandevelde',
    club_head_instructor: 'Luc Moreau',
    club_head_gsm: '0471009988',
    photo_storage_path: null,
    aliases: ['Peeters Thomas'],
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
  },
  {
    id: 'cand-sophie-lejeune',
    role: 'CMN_CANDIDATE',
    cohort_id: 'cohort-2026',
    sponsor_mn_id: 'mn-001',
    last_name: 'Lejeune',
    first_name: 'Sophie',
    birth_date: '1991-03-14',
    street_address: 'Quai des Ardennes 18',
    postal_code: '4020',
    city: 'Liège',
    phone_landline: null,
    phone_gsm: '0473887766',
    email: 'sophie.lejeune@lifras.be',
    febras_number: '0061234',
    cfps_year: 2019,
    mf_year: 2022,
    dives_count: 520,
    club_name: 'CAS Liège',
    club_president: 'Jean-Marc Lambert',
    club_head_instructor: 'Jean-Marc Lambert',
    club_head_gsm: '0475987654',
    photo_storage_path: null,
    aliases: ['Lejeune Sophie'],
    created_at: '2026-01-12T00:00:00Z',
    updated_at: '2026-01-12T00:00:00Z',
  },
  {
    id: 'cand-nicolas-renard',
    role: 'CMN_CANDIDATE',
    cohort_id: 'cohort-2026',
    sponsor_mn_id: 'mn-003',
    last_name: 'Renard',
    first_name: 'Nicolas',
    birth_date: '1986-11-22',
    street_address: 'Rue du Port 7',
    postal_code: '5000',
    city: 'Namur',
    phone_landline: null,
    phone_gsm: '0477334455',
    email: 'nicolas.renard@lifras.be',
    febras_number: '0058910',
    cfps_year: 2017,
    mf_year: 2020,
    dives_count: 780,
    club_name: 'Namur Plongée',
    club_president: 'Claire Dubois',
    club_head_instructor: 'Claire Dubois',
    club_head_gsm: '0472112233',
    photo_storage_path: null,
    aliases: ['Renard Nicolas'],
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  },
];

/**
 * Construit le jeu de données initial complet (les 20 évaluations Golden Dataset pour Thomas Peeters
 * + évaluations complémentaires pour Sophie Lejeune et Nicolas Renard) afin que le Cockpit Visuel
 * et la Vue Collège DTF soient immédiatement riches et exacts.
 */
function buildInitialDataset(): {
  evaluations: Evaluation[];
  scores: EvaluationScore[];
} {
  const buffer = buildSampleGoldenWorkbookBuffer();
  const parsed = parseCmnExcelWorkbook(
    buffer,
    'Golden_Dataset_Thomas_Peeters.xlsx',
    INITIAL_MN_DIRECTORY
  );

  const evaluations: Evaluation[] = [];
  const scores: EvaluationScore[] = [];

  // 1. Les 20 évaluations officielles de Thomas Peeters (cand-thomas-peeters)
  for (const row of parsed.evaluations) {
    if (!row.exam_code) continue;
    const evalId = `eval-tp-${row.legacy_row_id}`;
    const leadMatch = row.jury_matches.find((m) => m.matchedProfileId !== null);

    evaluations.push({
      id: evalId,
      legacy_row_id: row.legacy_row_id,
      candidate_id: 'cand-thomas-peeters',
      exam_code: row.exam_code,
      lead_evaluator_id: leadMatch?.matchedProfileId ?? 'mn-001',
      legacy_evaluator_raw: row.legacy_evaluator_raw,
      event_date: row.event_date,
      started_at: row.started_at,
      submitted_at: row.submitted_at,
      improvements_comment: row.improvements_comment,
      strengths_comment: row.strengths_comment,
      status: 'PUBLISHED',
      created_at: row.submitted_at ?? '2026-03-01T12:00:00Z',
      updated_at: row.submitted_at ?? '2026-03-01T12:00:00Z',
    });

    for (const sc of row.scores) {
      scores.push({
        evaluation_id: evalId,
        criterion_id: sc.criterion_id,
        grade: sc.grade,
      });
    }
  }

  // 2. Quelques évaluations pour Sophie Lejeune (cand-sophie-lejeune)
  const sophieEval1Id = 'eval-sl-1';
  evaluations.push({
    id: sophieEval1Id,
    legacy_row_id: 101,
    candidate_id: 'cand-sophie-lejeune',
    exam_code: 'COURS_MF',
    lead_evaluator_id: 'mn-001',
    legacy_evaluator_raw: 'Jean-Marc Lambert & Claire Dubois',
    event_date: '2026-03-14',
    started_at: '2026-03-14T09:00:00Z',
    submitted_at: '2026-03-14T11:30:00Z',
    improvements_comment: 'Rythmer davantage la seconde partie de l’exposé.',
    strengths_comment: 'Support visuel très pédagogique et maîtrise du sujet.',
    status: 'PUBLISHED',
    created_at: '2026-03-14T11:30:00Z',
    updated_at: '2026-03-14T11:30:00Z',
  });
  [1, 2, 3, 4, 5, 6, 7, 8].forEach((cId, i) => {
    scores.push({
      evaluation_id: sophieEval1Id,
      criterion_id: cId,
      grade: i % 2 === 0 ? 'TB' : 'B',
    });
  });

  const sophieEval2Id = 'eval-sl-2';
  evaluations.push({
    id: sophieEval2Id,
    legacy_row_id: 102,
    candidate_id: 'cand-sophie-lejeune',
    exam_code: 'PEDA_AM_MC',
    lead_evaluator_id: 'mn-003',
    legacy_evaluator_raw: 'Philippe Hendrickx',
    event_date: '2026-04-19',
    started_at: '2026-04-19T14:00:00Z',
    submitted_at: '2026-04-19T16:30:00Z',
    improvements_comment: 'Laisser le candidat AM s’auto-évaluer en début de débriefing.',
    strengths_comment: 'Détection fine des erreurs techniques.',
    status: 'PUBLISHED',
    created_at: '2026-04-19T16:30:00Z',
    updated_at: '2026-04-19T16:30:00Z',
  });
  [9, 10, 11, 12, 13, 14, 15].forEach((cId, i) => {
    scores.push({
      evaluation_id: sophieEval2Id,
      criterion_id: cId,
      grade: i < 4 ? 'B' : 'S',
    });
  });

  // 3. Une évaluation pour Nicolas Renard (cand-nicolas-renard)
  const nicolasEval1Id = 'eval-nr-1';
  evaluations.push({
    id: nicolasEval1Id,
    legacy_row_id: 201,
    candidate_id: 'cand-nicolas-renard',
    exam_code: 'ORGA_CARRIERE',
    lead_evaluator_id: 'mn-004',
    legacy_evaluator_raw: 'Marc Vandevelde & Luc Moreau',
    event_date: '2026-05-10',
    started_at: '2026-05-10T08:30:00Z',
    submitted_at: '2026-05-10T13:00:00Z',
    improvements_comment: 'Structurer plus clairement les consignes de sécurité oxygène.',
    strengths_comment: 'Bonne gestion des palanquées sur le terrain.',
    status: 'PUBLISHED',
    created_at: '2026-05-10T13:00:00Z',
    updated_at: '2026-05-10T13:00:00Z',
  });
  [61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72].forEach((cId, i) => {
    scores.push({
      evaluation_id: nicolasEval1Id,
      criterion_id: cId,
      grade: i % 3 === 0 ? 'B' : 'S',
    });
  });

  // 4. Les 25 évaluations officielles de Jennyfer Verhoeven (cand-jennyfer-verhoeven)
  evaluations.push(...JENNYFER_VERHOEVEN_EVALUATIONS);
  scores.push(...JENNYFER_VERHOEVEN_SCORES);

  // 5. Les 20 évaluations officielles de Valérie Gaspar (cand-valerie-gaspar)
  evaluations.push(...VALERIE_GASPAR_EVALUATIONS);
  scores.push(...VALERIE_GASPAR_SCORES);

  return { evaluations, scores };
}

const INITIAL_DATASET = buildInitialDataset();

const STORAGE_KEYS = {
  MN_DIRECTORY: 'cmn_lifras_mn_directory_v1',
  CANDIDATES: 'cmn_lifras_candidates_v1',
  EVALUATIONS: 'cmn_lifras_evaluations_v1',
  SCORES: 'cmn_lifras_scores_v1',
  AUDIT_LOGS: 'cmn_lifras_audit_logs_v1',
  DELETED_PROFILES: 'cmn_lifras_deleted_profiles_v1',
  ARCHIVED_PROFILES: 'cmn_lifras_archived_profiles_v1',
} as const;

function loadAndMergeById<T extends { id: string }>(
  key: string,
  defaults: T[]
): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    const stored = JSON.parse(raw) as T[];
    if (!Array.isArray(stored) || stored.length === 0) return defaults;
    const byId = new Map<string, T>();
    for (const item of defaults) {
      byId.set(item.id, item);
    }
    for (const item of stored) {
      byId.set(item.id, item);
    }
    return Array.from(byId.values());
  } catch {
    return defaults;
  }
}

function loadAndMergeScores(
  key: string,
  defaults: EvaluationScore[]
): EvaluationScore[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    const stored = JSON.parse(raw) as EvaluationScore[];
    if (!Array.isArray(stored) || stored.length === 0) return defaults;
    const byKey = new Map<string, EvaluationScore>();
    for (const sc of defaults) {
      byKey.set(`${sc.evaluation_id}:${sc.criterion_id}`, sc);
    }
    for (const sc of stored) {
      byKey.set(`${sc.evaluation_id}:${sc.criterion_id}`, sc);
    }
    return Array.from(byKey.values());
  } catch {
    return defaults;
  }
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function mergeArraysById<T extends { id: string }>(
  base: T[],
  incoming: T[]
): T[] {
  const byId = new Map<string, T>();
  for (const item of base) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

function mergeProfilesSmart(base: Profile[], incoming: Profile[]): Profile[] {
  const byId = new Map<string, Profile>();
  for (const item of base) {
    byId.set(item.id, item);
  }
  for (const inc of incoming) {
    const existing = byId.get(inc.id);
    if (!existing) {
      byId.set(inc.id, inc);
      continue;
    }
    const existingTs = Date.parse(existing.updated_at || '') || 0;
    const incomingTs = Date.parse(inc.updated_at || '') || 0;
    const winner = incomingTs >= existingTs ? inc : existing;
    const loser = incomingTs >= existingTs ? existing : inc;

    // Ne jamais écraser une photo existante par null lors d'une synchronisation multi-appareils
    const preservedPhoto =
      winner.photo_storage_path || loser.photo_storage_path || null;

    const mergedAliases = Array.from(
      new Set([...(existing.aliases ?? []), ...(inc.aliases ?? [])])
    );

    byId.set(inc.id, {
      ...winner,
      photo_storage_path: preservedPhoto,
      aliases: mergedAliases,
    });
  }
  return Array.from(byId.values());
}

function mergeScoresArrays(
  base: EvaluationScore[],
  incoming: EvaluationScore[]
): EvaluationScore[] {
  const byKey = new Map<string, EvaluationScore>();
  for (const sc of base) {
    byKey.set(`${sc.evaluation_id}:${sc.criterion_id}`, sc);
  }
  for (const sc of incoming) {
    byKey.set(`${sc.evaluation_id}:${sc.criterion_id}`, sc);
  }
  return Array.from(byKey.values());
}

const AdminStoreContext = createContext<AdminStoreContextValue | undefined>(undefined);

export function AdminStoreProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [deletedProfileIds, setDeletedProfileIds] = useState<string[]>(() =>
    loadFromStorage<string[]>(STORAGE_KEYS.DELETED_PROFILES, [])
  );
  const [archivedProfiles, setArchivedProfiles] = useState<Profile[]>(() =>
    loadFromStorage<Profile[]>(STORAGE_KEYS.ARCHIVED_PROFILES, [])
  );
  const deletedIdsRef = useRef<Set<string>>(new Set(deletedProfileIds));
  deletedIdsRef.current = new Set(deletedProfileIds);

  const [mnDirectory, setMnDirectory] = useState<Profile[]>(() => {
    const deleted = new Set(
      loadFromStorage<string[]>(STORAGE_KEYS.DELETED_PROFILES, [])
    );
    return loadAndMergeById(
      STORAGE_KEYS.MN_DIRECTORY,
      INITIAL_MN_DIRECTORY
    ).filter((p) => !deleted.has(p.id));
  });
  const [candidates, setCandidates] = useState<Profile[]>(() => {
    const deleted = new Set(
      loadFromStorage<string[]>(STORAGE_KEYS.DELETED_PROFILES, [])
    );
    return loadAndMergeById(
      STORAGE_KEYS.CANDIDATES,
      INITIAL_CANDIDATES
    ).filter((p) => !deleted.has(p.id));
  });
  const [evaluations, setEvaluations] = useState<Evaluation[]>(() =>
    loadAndMergeById(STORAGE_KEYS.EVALUATIONS, INITIAL_DATASET.evaluations)
  );
  const [evaluationScores, setEvaluationScores] = useState<EvaluationScore[]>(() =>
    loadAndMergeScores(STORAGE_KEYS.SCORES, INITIAL_DATASET.scores)
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() =>
    loadFromStorage(STORAGE_KEYS.AUDIT_LOGS, [])
  );

  // Refs toujours à jour pour que la réconciliation cloud lise l'état courant (jamais périmé)
  const mnRef = useRef<Profile[]>(mnDirectory);
  mnRef.current = mnDirectory;
  const candidatesRef = useRef<Profile[]>(candidates);
  candidatesRef.current = candidates;
  const evaluationsRef = useRef<Evaluation[]>(evaluations);
  evaluationsRef.current = evaluations;
  const scoresRef = useRef<EvaluationScore[]>(evaluationScores);
  scoresRef.current = evaluationScores;
  const auditLogsRef = useRef<AuditLog[]>(auditLogs);
  auditLogsRef.current = auditLogs;

  // Drapeaux pour éviter les boucles de ré-émission lors d'une réception Realtime depuis Supabase
  const isApplyingRemoteRef = useRef<boolean>(false);
  const hasHydratedCloudRef = useRef<boolean>(false);

  const pushKeyToCloud = async (key: string, payload: unknown): Promise<void> => {
    if (!isSupabaseConfigured || isApplyingRemoteRef.current) return;
    try {
      await supabase.from('cmn_shared_state').upsert({
        key,
        payload,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Ignore network errors silently (offline-first fallback)
    }
  };

  const applyRemoteRow = (key: string, payload: unknown): void => {
    if (!Array.isArray(payload)) return;
    isApplyingRemoteRef.current = true;
    try {
      if (key === 'deleted_profile_ids') {
        const incomingIds = payload as string[];
        const nextSet = new Set(incomingIds);
        deletedIdsRef.current = nextSet;
        setDeletedProfileIds(Array.from(nextSet));
        setMnDirectory((prev) => prev.filter((p) => !nextSet.has(p.id)));
        setCandidates((prev) => prev.filter((p) => !nextSet.has(p.id)));
      } else if (key === 'archived_profiles') {
        setArchivedProfiles(payload as Profile[]);
      } else if (key === 'mn_directory') {
        setMnDirectory((prev) =>
          mergeProfilesSmart(prev, payload as Profile[]).filter(
            (p) => !deletedIdsRef.current.has(p.id)
          )
        );
      } else if (key === 'candidates') {
        setCandidates((prev) =>
          mergeProfilesSmart(prev, payload as Profile[]).filter(
            (p) => !deletedIdsRef.current.has(p.id)
          )
        );
      } else if (key === 'evaluations') {
        setEvaluations((prev) =>
          mergeArraysById(prev, payload as Evaluation[])
        );
      } else if (key === 'scores') {
        setEvaluationScores((prev) =>
          mergeScoresArrays(prev, payload as EvaluationScore[])
        );
      } else if (key === 'audit_logs') {
        const incomingLogs = payload as AuditLog[];
        if (incomingLogs.length === 0) {
          setAuditLogs([]);
        } else {
          setAuditLogs((prev) => mergeArraysById(prev, incomingLogs));
        }
      }
    } finally {
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 150);
    }
  };

  const syncWithCloudNow = async (): Promise<{
    evaluationsCount: number;
    synced: boolean;
  }> => {
    if (!isSupabaseConfigured) {
      return { evaluationsCount: evaluationsRef.current.length, synced: false };
    }
    try {
      const { data, error } = await supabase
        .from('cmn_shared_state')
        .select('key, payload');
      if (error || !Array.isArray(data)) {
        return { evaluationsCount: evaluationsRef.current.length, synced: false };
      }

      if (data.length === 0) {
        const nowIso = new Date().toISOString();
        await Promise.all([
          supabase.from('cmn_shared_state').upsert({ key: 'mn_directory', payload: mnRef.current, updated_at: nowIso }),
          supabase.from('cmn_shared_state').upsert({ key: 'candidates', payload: candidatesRef.current, updated_at: nowIso }),
          supabase.from('cmn_shared_state').upsert({ key: 'evaluations', payload: evaluationsRef.current, updated_at: nowIso }),
          supabase.from('cmn_shared_state').upsert({ key: 'scores', payload: scoresRef.current, updated_at: nowIso }),
          supabase.from('cmn_shared_state').upsert({ key: 'audit_logs', payload: auditLogsRef.current, updated_at: nowIso }),
        ]);
        hasHydratedCloudRef.current = true;
        return { evaluationsCount: evaluationsRef.current.length, synced: true };
      }

      const remoteByKey = new Map<string, unknown>();
      for (const row of data) {
        remoteByKey.set(row.key as string, row.payload);
      }
      if (remoteByKey.has('deleted_profile_ids')) {
        applyRemoteRow('deleted_profile_ids', remoteByKey.get('deleted_profile_ids'));
      }
      for (const row of data) {
        if (row.key === 'deleted_profile_ids') continue;
        applyRemoteRow(row.key as string, row.payload);
      }

      const nowIso = new Date().toISOString();
      const upserts: PromiseLike<unknown>[] = [];

      const remoteMn = remoteByKey.get('mn_directory');
      if (Array.isArray(remoteMn)) {
        const mergedMn = mergeProfilesSmart(mnRef.current, remoteMn as Profile[]).filter(
          (p) => !deletedIdsRef.current.has(p.id)
        );
        const remoteHasAll = mergedMn.every((m) => {
          const r = (remoteMn as Profile[]).find((x) => x.id === m.id);
          return Boolean(r) && (!m.photo_storage_path || Boolean(r?.photo_storage_path));
        });
        if (!remoteHasAll) {
          upserts.push(
            supabase.from('cmn_shared_state').upsert({ key: 'mn_directory', payload: mergedMn, updated_at: nowIso })
          );
        }
      }

      const remoteCand = remoteByKey.get('candidates');
      if (Array.isArray(remoteCand)) {
        const mergedCand = mergeProfilesSmart(candidatesRef.current, remoteCand as Profile[]).filter(
          (p) => !deletedIdsRef.current.has(p.id)
        );
        const remoteHasAll = mergedCand.every((c) => {
          const r = (remoteCand as Profile[]).find((x) => x.id === c.id);
          return Boolean(r) && (!c.photo_storage_path || Boolean(r?.photo_storage_path));
        });
        if (!remoteHasAll) {
          upserts.push(
            supabase.from('cmn_shared_state').upsert({ key: 'candidates', payload: mergedCand, updated_at: nowIso })
          );
        }
      }

      let finalEvalCount = evaluationsRef.current.length;
      const remoteEvals = remoteByKey.get('evaluations');
      if (Array.isArray(remoteEvals)) {
        const mergedEvals = mergeArraysById(evaluationsRef.current, remoteEvals as Evaluation[]);
        finalEvalCount = mergedEvals.length;
        if (mergedEvals.length > remoteEvals.length) {
          upserts.push(
            supabase.from('cmn_shared_state').upsert({ key: 'evaluations', payload: mergedEvals, updated_at: nowIso })
          );
        }
      }

      const remoteScores = remoteByKey.get('scores');
      if (Array.isArray(remoteScores)) {
        const mergedScores = mergeScoresArrays(scoresRef.current, remoteScores as EvaluationScore[]);
        if (mergedScores.length > remoteScores.length) {
          upserts.push(
            supabase.from('cmn_shared_state').upsert({ key: 'scores', payload: mergedScores, updated_at: nowIso })
          );
        }
      }

      if (upserts.length > 0) {
        await Promise.all(upserts);
      }

      hasHydratedCloudRef.current = true;
      return { evaluationsCount: finalEvalCount, synced: true };
    } catch {
      return { evaluationsCount: evaluationsRef.current.length, synced: false };
    }
  };

  // Synchronisation initiale, au retour sur l'onglet (GSM/PC) et temps réel via Supabase cmn_shared_state
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    void syncWithCloudNow();

    const handleVisibilityOrOnline = (): void => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void syncWithCloudNow();
      }
    };

    window.addEventListener('online', handleVisibilityOrOnline);
    document.addEventListener('visibilitychange', handleVisibilityOrOnline);

    const channel = supabase
      .channel('cmn-shared-state-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cmn_shared_state' },
        (change) => {
          const newRow = change.new as { key?: string; payload?: unknown } | null;
          if (newRow?.key && newRow.payload !== undefined) {
            applyRemoteRow(newRow.key, newRow.payload);
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('online', handleVisibilityOrOnline);
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MN_DIRECTORY, JSON.stringify(mnDirectory));
    } catch {
      // Ignore quota errors
    }
    if (hasHydratedCloudRef.current) {
      void pushKeyToCloud('mn_directory', mnDirectory);
    }
  }, [mnDirectory]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CANDIDATES, JSON.stringify(candidates));
    } catch {
      // Ignore quota errors
    }
    if (hasHydratedCloudRef.current) {
      void pushKeyToCloud('candidates', candidates);
    }
  }, [candidates]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(evaluations));
    } catch {
      // Ignore quota errors
    }
    if (hasHydratedCloudRef.current) {
      void pushKeyToCloud('evaluations', evaluations);
    }
  }, [evaluations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SCORES, JSON.stringify(evaluationScores));
    } catch {
      // Ignore quota errors
    }
    if (hasHydratedCloudRef.current) {
      void pushKeyToCloud('scores', evaluationScores);
    }
  }, [evaluationScores]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.DELETED_PROFILES,
        JSON.stringify(deletedProfileIds)
      );
    } catch {
      // Ignore quota errors
    }
    if (hasHydratedCloudRef.current) {
      void pushKeyToCloud('deleted_profile_ids', deletedProfileIds);
    }
  }, [deletedProfileIds]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.ARCHIVED_PROFILES,
        JSON.stringify(archivedProfiles)
      );
    } catch {
      // Ignore quota errors
    }
    if (hasHydratedCloudRef.current) {
      void pushKeyToCloud('archived_profiles', archivedProfiles);
    }
  }, [archivedProfiles]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
    } catch {
      // Ignore quota errors
    }
    if (hasHydratedCloudRef.current) {
      void pushKeyToCloud('audit_logs', auditLogs);
    }
  }, [auditLogs]);

  const addAliasToMn = (mnProfileId: string, alias: string): void => {
    const trimmed = alias.trim();
    if (!trimmed) return;
    setMnDirectory((prev) =>
      prev.map((mn) => {
        if (mn.id !== mnProfileId) return mn;
        if (mn.aliases.includes(trimmed)) return mn;
        return {
          ...mn,
          aliases: [...mn.aliases, trimmed],
          updated_at: new Date().toISOString(),
        };
      })
    );
  };

  const importCandidateWorkbookData = (payload: {
    candidateProfile: Profile;
    newEvaluations: Evaluation[];
    newScores: EvaluationScore[];
    auditLog: AuditLog;
  }): void => {
    setCandidates((prev) => {
      const exists = prev.some(
        (c) =>
          c.email.toLowerCase() === payload.candidateProfile.email.toLowerCase() ||
          c.id === payload.candidateProfile.id
      );
      if (exists) {
        return prev.map((c) => {
          const isMatch =
            c.email.toLowerCase() === payload.candidateProfile.email.toLowerCase() ||
            c.id === payload.candidateProfile.id;
          if (!isMatch) return c;
          return {
            ...payload.candidateProfile,
            id: c.id,
            photo_storage_path:
              payload.candidateProfile.photo_storage_path || c.photo_storage_path || null,
            aliases: Array.from(
              new Set([...(c.aliases ?? []), ...(payload.candidateProfile.aliases ?? [])])
            ),
          };
        });
      }
      return [...prev, payload.candidateProfile];
    });

    setEvaluations((prev) => {
      const legacyIds = new Set(
        payload.newEvaluations
          .map((e) => e.legacy_row_id)
          .filter((id): id is number => id !== null && id !== undefined)
      );
      const filtered = prev.filter(
        (ev) =>
          ev.candidate_id !== payload.candidateProfile.id ||
          ev.legacy_row_id === null ||
          !legacyIds.has(ev.legacy_row_id)
      );
      return [...filtered, ...payload.newEvaluations];
    });
    setEvaluationScores((prev) => [...prev, ...payload.newScores]);
    setAuditLogs((prev) => [payload.auditLog, ...prev]);
  };

  const applyReclassification = (payload: {
    updatedEvaluation: Evaluation;
    updatedScores: EvaluationScore[];
    auditLogEntry: AuditLog;
  }): void => {
    setEvaluations((prev) =>
      prev.map((ev) =>
        ev.id === payload.updatedEvaluation.id ? payload.updatedEvaluation : ev
      )
    );
    setEvaluationScores((prev) => {
      const filtered = prev.filter(
        (sc) => sc.evaluation_id !== payload.updatedEvaluation.id
      );
      return [...filtered, ...payload.updatedScores];
    });
    setAuditLogs((prev) => [payload.auditLogEntry, ...prev]);
  };

  const recordFieldEvaluation = (payload: {
    evaluation: Evaluation;
    scores: EvaluationScore[];
  }): void => {
    setEvaluations((prev) => {
      if (prev.some((e) => e.id === payload.evaluation.id)) {
        return prev;
      }
      return [payload.evaluation, ...prev];
    });
    setEvaluationScores((prev) => [...prev, ...payload.scores]);
  };

  const createCandidateProfile = (payload: {
    candidateProfile: Profile;
    auditLog: AuditLog;
  }): void => {
    if (payload.candidateProfile.role === 'CMN_CANDIDATE') {
      setCandidates((prev) => [...prev, payload.candidateProfile]);
    } else {
      setMnDirectory((prev) => [...prev, payload.candidateProfile]);
    }
    setAuditLogs((prev) => [payload.auditLog, ...prev]);
  };

  const updateProfileRole = (
    profileId: string,
    newRole: Profile['role'],
    actorId: string
  ): void => {
    const nowIso = new Date().toISOString();
    const targetInMn = mnDirectory.find((p) => p.id === profileId);
    const targetInCand = candidates.find((p) => p.id === profileId);
    const target = targetInMn ?? targetInCand;
    if (!target || target.role === newRole) return;

    const prevRole = target.role;
    const updatedProfile: Profile = {
      ...target,
      role: newRole,
      updated_at: nowIso,
    };

    if (targetInMn) {
      setMnDirectory((prev) =>
        prev.map((p) => (p.id === profileId ? updatedProfile : p))
      );
    } else {
      setCandidates((prev) =>
        prev.map((p) => (p.id === profileId ? updatedProfile : p))
      );
    }

    const logEntry: AuditLog = {
      id: `audit-role-${Date.now()}`,
      actor_id: actorId,
      entity_type: 'profiles',
      entity_id: profileId,
      action: 'UPDATE_USER_ROLE',
      previous_value: { role: prevRole },
      new_value: { role: newRole },
      reason: `Changement d'habilitation de ${target.first_name} ${target.last_name} (${prevRole} -> ${newRole})`,
      created_at: nowIso,
    };
    setAuditLogs((prev) => [logEntry, ...prev]);
  };

  const updateFullProfile = (updated: Profile, actorId: string): void => {
    const nowIso = new Date().toISOString();
    const withTimestamp: Profile = { ...updated, updated_at: nowIso };

    setMnDirectory((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      if (updated.role === 'CMN_CANDIDATE') {
        return prev.filter((p) => p.id !== updated.id);
      }
      return exists
        ? prev.map((p) => (p.id === updated.id ? withTimestamp : p))
        : [...prev, withTimestamp];
    });

    setCandidates((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      if (updated.role !== 'CMN_CANDIDATE') {
        return prev.filter((p) => p.id !== updated.id);
      }
      return exists
        ? prev.map((p) => (p.id === updated.id ? withTimestamp : p))
        : [...prev, withTimestamp];
    });

    const logEntry: AuditLog = {
      id: `audit-prof-${Date.now()}`,
      actor_id: actorId,
      entity_type: 'profiles',
      entity_id: updated.id,
      action: 'UPDATE_USER_PROFILE',
      previous_value: null,
      new_value: {
        first_name: updated.first_name,
        last_name: updated.last_name,
        email: updated.email,
        role: updated.role,
        febras_number: updated.febras_number,
        club_name: updated.club_name,
      },
      reason: `Modification administrative du profil de ${updated.first_name} ${updated.last_name} (${updated.role})`,
      created_at: nowIso,
    };
    setAuditLogs((prev) => [logEntry, ...prev]);
  };

  const deleteProfile = (profileId: string, actorId: string): void => {
    const target =
      mnDirectory.find((p) => p.id === profileId) ??
      candidates.find((p) => p.id === profileId);
    if (!target) return;

    const nowIso = new Date().toISOString();
    const nextDeleted = Array.from(new Set([...deletedIdsRef.current, profileId]));
    deletedIdsRef.current = new Set(nextDeleted);
    setDeletedProfileIds(nextDeleted);
    setArchivedProfiles((prev) => [
      { ...target, updated_at: nowIso },
      ...prev.filter((p) => p.id !== profileId),
    ]);
    setMnDirectory((prev) => prev.filter((p) => p.id !== profileId));
    setCandidates((prev) => prev.filter((p) => p.id !== profileId));

    const logEntry: AuditLog = {
      id: `audit-del-prof-${Date.now()}`,
      actor_id: actorId,
      entity_type: 'profiles',
      entity_id: profileId,
      action: 'DELETE_USER_PROFILE',
      previous_value: {
        first_name: target.first_name,
        last_name: target.last_name,
        email: target.email,
        role: target.role,
        febras_number: target.febras_number,
      },
      new_value: null,
      reason: `Suppression administrative (archivé en corbeille concepteur) du profil de ${target.first_name} ${target.last_name} (${target.role})`,
      created_at: nowIso,
    };
    setAuditLogs((prev) => [logEntry, ...prev]);
  };

  const restoreProfile = (
    profileId: string,
    actorEmail: string,
    actorId: string
  ): void => {
    if (!isCreatorAccount(actorEmail, actorId)) return;
    const archived = archivedProfiles.find((p) => p.id === profileId);
    if (!archived) return;

    const nowIso = new Date().toISOString();
    const restored: Profile = { ...archived, updated_at: nowIso };

    const nextDeleted = deletedProfileIds.filter((id) => id !== profileId);
    deletedIdsRef.current = new Set(nextDeleted);
    setDeletedProfileIds(nextDeleted);
    setArchivedProfiles((prev) => prev.filter((p) => p.id !== profileId));

    if (restored.role === 'CMN_CANDIDATE') {
      setCandidates((prev) => [
        ...prev.filter((p) => p.id !== profileId),
        restored,
      ]);
    } else {
      setMnDirectory((prev) => [
        ...prev.filter((p) => p.id !== profileId),
        restored,
      ]);
    }

    const logEntry: AuditLog = {
      id: `audit-restore-prof-${Date.now()}`,
      actor_id: actorId,
      entity_type: 'profiles',
      entity_id: profileId,
      action: 'RESTORE_USER_PROFILE',
      previous_value: null,
      new_value: {
        first_name: restored.first_name,
        last_name: restored.last_name,
        email: restored.email,
        role: restored.role,
        febras_number: restored.febras_number,
      },
      reason: `Restauration depuis la corbeille concepteur du profil de ${restored.first_name} ${restored.last_name} (${restored.role})`,
      created_at: nowIso,
    };
    setAuditLogs((prev) => [logEntry, ...prev]);
  };

  const purgeArchivedProfile = (
    profileId: string,
    actorEmail: string,
    actorId: string
  ): void => {
    if (!isCreatorAccount(actorEmail, actorId)) return;
    setArchivedProfiles((prev) => prev.filter((p) => p.id !== profileId));
  };

  const clearAuditLogs = (actorEmail: string, actorId: string): void => {
    if (!isCreatorAccount(actorEmail, actorId)) return;
    setAuditLogs([]);
    try {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]));
    } catch {
      // Ignore quota errors
    }
    if (isSupabaseConfigured) {
      void supabase.from('cmn_shared_state').upsert({
        key: 'audit_logs',
        payload: [],
        updated_at: new Date().toISOString(),
      });
    }
  };

  return (
    <AdminStoreContext.Provider
      value={{
        mnDirectory,
        candidates,
        evaluations,
        evaluationScores,
        auditLogs,
        archivedProfiles,
        addAliasToMn,
        importCandidateWorkbookData,
        applyReclassification,
        recordFieldEvaluation,
        createCandidateProfile,
        updateProfileRole,
        updateFullProfile,
        deleteProfile,
        restoreProfile,
        purgeArchivedProfile,
        clearAuditLogs,
        syncWithCloudNow,
      }}
    >
      {children}
    </AdminStoreContext.Provider>
  );
}

export function useAdminStore(): AdminStoreContextValue {
  const ctx = useContext(AdminStoreContext);
  if (!ctx) {
    throw new Error('useAdminStore doit être utilisé au sein d’un AdminStoreProvider.');
  }
  return ctx;
}
