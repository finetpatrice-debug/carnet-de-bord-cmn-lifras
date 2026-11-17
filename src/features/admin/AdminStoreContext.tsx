import React, { createContext, useContext, useState } from 'react';
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

interface AdminStoreContextValue {
  mnDirectory: Profile[];
  candidates: Profile[];
  evaluations: Evaluation[];
  evaluationScores: EvaluationScore[];
  auditLogs: AuditLog[];
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
];

const INITIAL_CANDIDATES: Profile[] = [
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

  return { evaluations, scores };
}

const INITIAL_DATASET = buildInitialDataset();

const AdminStoreContext = createContext<AdminStoreContextValue | undefined>(undefined);

export function AdminStoreProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [mnDirectory, setMnDirectory] = useState<Profile[]>(INITIAL_MN_DIRECTORY);
  const [candidates, setCandidates] = useState<Profile[]>(INITIAL_CANDIDATES);
  const [evaluations, setEvaluations] = useState<Evaluation[]>(
    INITIAL_DATASET.evaluations
  );
  const [evaluationScores, setEvaluationScores] = useState<EvaluationScore[]>(
    INITIAL_DATASET.scores
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

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
        return prev.map((c) =>
          c.email.toLowerCase() === payload.candidateProfile.email.toLowerCase()
            ? payload.candidateProfile
            : c
        );
      }
      return [...prev, payload.candidateProfile];
    });

    setEvaluations((prev) => [...prev, ...payload.newEvaluations]);
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

  return (
    <AdminStoreContext.Provider
      value={{
        mnDirectory,
        candidates,
        evaluations,
        evaluationScores,
        auditLogs,
        addAliasToMn,
        importCandidateWorkbookData,
        applyReclassification,
        recordFieldEvaluation,
        createCandidateProfile,
        updateProfileRole,
        updateFullProfile,
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
