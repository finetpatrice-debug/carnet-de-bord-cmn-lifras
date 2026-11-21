import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '@/features/auth/AuthContext';
import { useAdminStore } from '@/features/admin/AdminStoreContext';
import {
  offlineDb,
  submitOrQueueEvaluation,
} from '@/services/offlineQueue';
import {
  OFFICIAL_CRITERIA,
  OFFICIAL_EXAM_TYPES,
  OFFICIAL_PILLARS,
} from '@/domain/referentials';
import { computeExamAverage } from '@/domain/scoringEngine';
import {
  GRADE_LABELS,
  type Criterion,
  type EvaluationScore,
  type ExamCode,
  type GradeCode,
  type PillarCode,
  type Profile,
} from '@/domain/types';
import { useSpeechDictation } from './useSpeechDictation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  UserCheck,
  Users,
  WifiOff,
  X,
} from 'lucide-react';

interface GradeButtonConfig {
  code: GradeCode;
  label: string;
  pointsLabel: string;
  activeClass: string;
  inactiveClass: string;
}

/**
 * 7 boutons tactiles larges et contrastés pour le barème officiel à 6 niveaux (10, 8, 6, 4, 2, 1) + NE :
 * 10 (vert émeraude), 8 (vert clair), 6 (ambre), 4 (orange), 2 (rouge-orangé), 1 (rouge foncé), NE (gris ardoise)
 */
const TACTILE_GRADE_BUTTONS: GradeButtonConfig[] = [
  {
    code: 'TB',
    label: '10',
    pointsLabel: '10 / 10',
    activeClass:
      'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400 shadow-md scale-[1.02]',
    inactiveClass:
      'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100',
  },
  {
    code: 'B',
    label: '8',
    pointsLabel: '8 / 10',
    activeClass:
      'bg-green-500 text-white border-green-600 ring-2 ring-green-300 shadow-md scale-[1.02]',
    inactiveClass:
      'bg-green-50 text-green-900 border-green-200 hover:bg-green-100',
  },
  {
    code: 'S',
    label: '6',
    pointsLabel: '6 / 10',
    activeClass:
      'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300 shadow-md scale-[1.02]',
    inactiveClass:
      'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100',
  },
  {
    code: 'I',
    label: '4',
    pointsLabel: '4 / 10',
    activeClass:
      'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-300 shadow-md scale-[1.02]',
    inactiveClass:
      'bg-orange-50 text-orange-900 border-orange-200 hover:bg-orange-100',
  },
  {
    code: 'M',
    label: '2',
    pointsLabel: '2 / 10',
    activeClass:
      'bg-red-500 text-white border-red-600 ring-2 ring-red-300 shadow-md scale-[1.02]',
    inactiveClass:
      'bg-red-50 text-red-900 border-red-200 hover:bg-red-100',
  },
  {
    code: '1',
    label: '1',
    pointsLabel: '1 / 10',
    activeClass:
      'bg-rose-700 text-white border-rose-800 ring-2 ring-rose-400 shadow-md scale-[1.02]',
    inactiveClass:
      'bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100',
  },
  {
    code: 'NE',
    label: 'NE',
    pointsLabel: 'Non évalué',
    activeClass:
      'bg-slate-600 text-white border-slate-700 ring-2 ring-slate-400 shadow-md scale-[1.02]',
    inactiveClass:
      'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200',
  },
];

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function EvaluationPage(): React.ReactElement {
  const { profile: activeEvaluator } = useAuth();
  const {
    candidates: storeCandidates,
    mnDirectory: storeEvaluators,
    recordFieldEvaluation,
  } = useAdminStore();

  // Lecture Offline-First depuis IndexedDB (Dexie) avec repli immédiat sur le store en mémoire
  const cachedCandidates = useLiveQuery(() => offlineDb.candidates.toArray(), []);
  const cachedEvaluators = useLiveQuery(() => offlineDb.evaluators.toArray(), []);
  const cachedCriteria = useLiveQuery(() => offlineDb.criteria.toArray(), []);

  const candidatesList: Profile[] =
    cachedCandidates && cachedCandidates.length > 0
      ? cachedCandidates
      : storeCandidates;

  const evaluatorsList: Profile[] =
    cachedEvaluators && cachedEvaluators.length > 0
      ? cachedEvaluators
      : storeEvaluators;

  const criteriaList: Criterion[] =
    cachedCriteria && cachedCriteria.length > 0
      ? cachedCriteria
      : OFFICIAL_CRITERIA;

  // Filtrage des candidats sur la cohorte active
  const activeCohortCandidates = useMemo(
    () =>
      candidatesList.filter(
        (c) => c.role === 'CMN_CANDIDATE' && Boolean(c.cohort_id)
      ),
    [candidatesList]
  );

  const [searchParams] = useSearchParams();
  const initialCandidateFromUrl = searchParams.get('candidat');

  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    () => initialCandidateFromUrl ?? null
  );

  useEffect(() => {
    if (
      initialCandidateFromUrl &&
      activeCohortCandidates.some((c) => c.id === initialCandidateFromUrl)
    ) {
      setSelectedCandidateId(initialCandidateFromUrl);
    }
  }, [initialCandidateFromUrl, activeCohortCandidates]);
  const [selectedCoEvaluatorIds, setSelectedCoEvaluatorIds] = useState<string[]>(
    []
  );
  const [coEvalSearchQuery, setCoEvalSearchQuery] = useState<string>('');
  const [showCoEvalDirectory, setShowCoEvalDirectory] = useState<boolean>(false);
  const [eventDate, setEventDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [startedAt] = useState<string>(() => new Date().toISOString());
  const [selectedExamCode, setSelectedExamCode] =
    useState<ExamCode>('PEDA_AM_MC');

  // Cotations unitaires saisies (criterion_id -> GradeCode)
  const [gradesByCriterion, setGradesByCriterion] = useState<
    Record<number, GradeCode>
  >({});

  // Commentaires constructifs obligatoires
  const [strengthsComment, setStrengthsComment] = useState<string>('');
  const [improvementsComment, setImprovementsComment] = useState<string>('');

  // Mode test hors-ligne simulé + retours de soumission
  const [simulateOffline, setSimulateOffline] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    type: 'SYNCED' | 'QUEUED_OFFLINE';
    message: string;
  } | null>(null);

  // Hooks de dictée vocale (fr-BE) pour les 2 zones de commentaires
  const strengthsDictation = useSpeechDictation((chunk) => {
    setStrengthsComment((prev) => (prev ? `${prev} ${chunk}` : chunk));
  });

  const improvementsDictation = useSpeechDictation((chunk) => {
    setImprovementsComment((prev) => (prev ? `${prev} ${chunk}` : chunk));
  });

  // Critères actifs de l'épreuve sélectionnée
  const examCriteria = useMemo(
    () =>
      criteriaList
        .filter((c) => c.exam_code === selectedExamCode && c.is_active)
        .sort((a, b) => a.order_in_exam - b.order_in_exam),
    [criteriaList, selectedExamCode]
  );

  // Regroupement par pilier de compétence
  const criteriaGroupedByPillar = useMemo(() => {
    const groups: {
      pillarCode: PillarCode;
      pillarTitle: string;
      items: Criterion[];
    }[] = [];

    for (const pillar of OFFICIAL_PILLARS) {
      const items = examCriteria.filter((c) => c.pillar_code === pillar.code);
      if (items.length > 0) {
        groups.push({
          pillarCode: pillar.code,
          pillarTitle: pillar.title,
          items,
        });
      }
    }
    return groups;
  }, [examCriteria]);

  // Progression de la saisie
  const totalQuestionsCount = examCriteria.length;
  const answeredQuestionsCount = useMemo(
    () =>
      examCriteria.filter((c) => gradesByCriterion[c.id] !== undefined).length,
    [examCriteria, gradesByCriterion]
  );
  const progressPercent =
    totalQuestionsCount > 0
      ? Math.round((answeredQuestionsCount / totalQuestionsCount) * 100)
      : 0;
  const allQuestionsAnswered =
    totalQuestionsCount > 0 && answeredQuestionsCount === totalQuestionsCount;

  const commentsValid =
    strengthsComment.trim().length >= 3 &&
    improvementsComment.trim().length >= 3;

  const canSubmit =
    Boolean(selectedCandidateId) &&
    Boolean(eventDate) &&
    allQuestionsAnswered &&
    commentsValid &&
    !submitting;

  // Aperçu temps réel de la moyenne de l'épreuve via scoringEngine.ts
  const liveExamAveragePreview = useMemo(() => {
    const scoresArray: EvaluationScore[] = Object.entries(gradesByCriterion).map(
      ([critId, grade]) => ({
        evaluation_id: 'live-preview',
        criterion_id: Number(critId),
        grade,
      })
    );
    return computeExamAverage(selectedExamCode, examCriteria, scoresArray);
  }, [selectedExamCode, examCriteria, gradesByCriterion]);

  // Changement d'épreuve : réinitialise la grille de cotation
  const handleSelectExam = (newExamCode: ExamCode): void => {
    setSelectedExamCode(newExamCode);
    setGradesByCriterion({});
    setSubmissionFeedback(null);
  };

  const handleSelectGrade = (criterionId: number, grade: GradeCode): void => {
    setGradesByCriterion((prev) => {
      // Un second clic sur la note déjà active la décoche (reset rapide)
      if (prev[criterionId] === grade) {
        const next = { ...prev };
        delete next[criterionId];
        return next;
      }
      return {
        ...prev,
        [criterionId]: grade,
      };
    });
  };

  const handleClearGrade = (criterionId: number): void => {
    setGradesByCriterion((prev) => {
      const next = { ...prev };
      delete next[criterionId];
      return next;
    });
  };

  const handleResetAllGrades = (): void => {
    if (
      answeredQuestionsCount > 0 &&
      !window.confirm(
        'Voulez-vous vraiment réinitialiser toutes les cotations de cette épreuve ?'
      )
    ) {
      return;
    }
    setGradesByCriterion({});
    setSubmissionFeedback(null);
  };

  // Auto-complétion stricte des co-examinateurs MN (zéro texte libre)
  const filteredEvaluatorSuggestions = useMemo(() => {
    const q = coEvalSearchQuery.trim().toLowerCase();
    return evaluatorsList.filter((mn) => {
      if (mn.id === activeEvaluator?.id) return false;
      if (selectedCoEvaluatorIds.includes(mn.id)) return false;
      if (!q) return true;
      const fullName = `${mn.first_name} ${mn.last_name}`.toLowerCase();
      const febras = (mn.febras_number ?? '').toLowerCase();
      return fullName.includes(q) || febras.includes(q);
    });
  }, [evaluatorsList, activeEvaluator?.id, selectedCoEvaluatorIds, coEvalSearchQuery]);

  const addCoEvaluator = (mnId: string): void => {
    if (!selectedCoEvaluatorIds.includes(mnId)) {
      setSelectedCoEvaluatorIds((prev) => [...prev, mnId]);
    }
    setCoEvalSearchQuery('');
  };

  const removeCoEvaluator = (mnId: string): void => {
    setSelectedCoEvaluatorIds((prev) => prev.filter((id) => id !== mnId));
  };

  const handleSubmitEvaluation = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!canSubmit || !selectedCandidateId) return;

    setSubmitting(true);
    setSubmissionFeedback(null);

    const nowIso = new Date().toISOString();
    const evalId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `eval-mob-${Date.now()}`;

    const leadName = activeEvaluator
      ? `${activeEvaluator.first_name} ${activeEvaluator.last_name}`
      : 'MN Évaluateur';
    const coNames = selectedCoEvaluatorIds
      .map((id) => {
        const m = evaluatorsList.find((e) => e.id === id);
        return m ? `${m.first_name} ${m.last_name}` : null;
      })
      .filter(Boolean);
    const juryRawLabel = [leadName, ...coNames].join(' & ');

    const scoresPayload = examCriteria.map((crit) => ({
      criterion_id: crit.id,
      grade: gradesByCriterion[crit.id] ?? ('NE' as GradeCode),
    }));

    const result = await submitOrQueueEvaluation(
      {
        id: evalId,
        candidate_id: selectedCandidateId,
        exam_code: selectedExamCode,
        lead_evaluator_id: activeEvaluator?.id ?? 'mn-001',
        co_evaluator_ids: selectedCoEvaluatorIds,
        legacy_evaluator_raw: juryRawLabel,
        event_date: eventDate,
        started_at: startedAt,
        submitted_at: nowIso,
        improvements_comment: improvementsComment.trim(),
        strengths_comment: strengthsComment.trim(),
        scores: scoresPayload,
        created_at: nowIso,
      },
      {
        forceOffline: simulateOffline,
        onSyncedToStore: recordFieldEvaluation,
      }
    );

    setSubmitting(false);
    setGradesByCriterion({});
    setStrengthsComment('');
    setImprovementsComment('');

    if (result.mode === 'QUEUED_OFFLINE') {
      setSubmissionFeedback({
        type: 'QUEUED_OFFLINE',
        message:
          "Évaluation enregistrée hors-ligne dans IndexedDB (outbox_evaluations). Le badge « En attente de réseau » s'est mis à jour et synchronisera automatiquement dès le retour de la connexion.",
      });
    } else {
      setSubmissionFeedback({
        type: 'SYNCED',
        message:
          'Évaluation terrain publiée et synchronisée avec succès.',
      });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-12">
      {/* Barre de progression collante Mobile-First en haut d'écran (uniquement après sélection d'un candidat) */}
      {selectedCandidateId && (
      <div className="sticky top-[54px] md:top-[104px] z-20 rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-md backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <ClipboardCheck className="h-4 w-4 text-sky-600" />
            <span>
              Progression : {answeredQuestionsCount} / {totalQuestionsCount}{' '}
              critères cotés ({progressPercent}%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">
              Moyenne Iso-Excel : {liveExamAveragePreview.formattedAverage}
            </Badge>
            {answeredQuestionsCount > 0 && (
              <button
                type="button"
                onClick={handleResetAllGrades}
                title="Réinitialiser toutes les cotations de cette grille"
                className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-100"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset grille</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSimulateOffline((prev) => !prev)}
              className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition ${
                simulateOffline
                  ? 'border-amber-500 bg-amber-100 text-amber-900'
                  : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title="Permet de tester la mise en file d'attente hors-ligne outbox_evaluations même sur un poste connecté"
            >
              <WifiOff className="h-3 w-3" />
              <span>
                {simulateOffline ? 'Test Hors-Ligne ACTIF' : 'Simuler Hors-Ligne'}
              </span>
            </button>
          </div>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full transition-all duration-300 ${
              allQuestionsAnswered ? 'bg-emerald-600' : 'bg-sky-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      )}

      {submissionFeedback && (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 text-sm shadow-sm ${
            submissionFeedback.type === 'QUEUED_OFFLINE'
              ? 'border-amber-300 bg-amber-50 text-amber-950'
              : 'border-emerald-300 bg-emerald-50 text-emerald-950'
          }`}
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-current" />
          <div>
            <div className="font-bold">
              {submissionFeedback.type === 'QUEUED_OFFLINE'
                ? 'Sauvegardé dans la boîte d’envoi hors-ligne (Dexie IndexedDB)'
                : 'Évaluation publiée'}
            </div>
            <p className="mt-0.5 text-xs">{submissionFeedback.message}</p>
          </div>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmitEvaluation(e)} className="space-y-5">
        {/* 1. Sélection rapide du Candidat CMN (avec photo/avatar et club, filtré cohorte active) */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                1. Candidat CMN évalué (Promotion en cours)
              </CardTitle>
              <Badge variant="outline" className="text-[11px]">
                {activeCohortCandidates.length} CMN actifs
              </Badge>
            </div>
            <CardDescription>
              {selectedCandidateId
                ? 'Candidat sélectionné : remplissez la grille d’évaluation ci-dessous (cliquez sur un autre candidat pour changer).'
                : 'Sélectionnez un candidat de la promotion en cours pour ouvrir sa grille d’évaluation terrain.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {activeCohortCandidates.map((cand) => {
              const isSelected = cand.id === selectedCandidateId;
              return (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() =>
                    setSelectedCandidateId((prev) =>
                      prev === cand.id ? null : cand.id
                    )
                  }
                  className={`flex min-w-0 items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
                    isSelected
                      ? 'border-sky-600 bg-sky-50/90 ring-2 ring-sky-500/40 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {cand.photo_storage_path ? (
                    <img
                      src={cand.photo_storage_path}
                      alt={`${cand.first_name} ${cand.last_name}`}
                      className="h-11 w-11 shrink-0 rounded-full border border-sky-400 object-cover"
                    />
                  ) : (
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        isSelected
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {getInitials(cand.first_name, cand.last_name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-900">
                      {cand.first_name} {cand.last_name}
                    </div>
                    <div className="truncate text-xs text-slate-600">
                      {cand.club_name ?? 'Club LIFRAS'}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">
                      FEBRAS #{cand.febras_number ?? '—'}
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {selectedCandidateId && (
        <>
        {/* 2. Jury MN (Co-examinateurs via puces auto-complétées, zéro texte libre) & Date */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-sky-600" />
              <CardTitle className="text-base">
                2. Jury d’Évaluation MN & Date de Prestation
              </CardTitle>
            </div>
            <CardDescription>
              Sélection stricte dans l’annuaire officiel <code>MN_EVALUATOR</code>{' '}
              (zéro saisie libre pour empêcher tout doublon identitaire).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Évaluateur principal connecté
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                  <UserCheck className="h-4 w-4 text-sky-600" />
                  <span>
                    {activeEvaluator
                      ? `${activeEvaluator.first_name} ${activeEvaluator.last_name}`
                      : 'Jean-Marc Lambert (MN)'}
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="eval-event-date"
                  className="text-xs font-semibold uppercase text-slate-500"
                >
                  Date de la prestation
                </label>
                <div className="relative mt-1">
                  <Input
                    id="eval-event-date"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="h-10 font-medium"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Puces des co-examinateurs sélectionnés */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="co-evaluator-search"
                  className="text-xs font-semibold uppercase text-slate-500"
                >
                  Co-examinateurs MN (optionnel)
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCoEvalDirectory((prev) => !prev)}
                  className="h-7 px-2.5 text-xs"
                >
                  {showCoEvalDirectory ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Réduire la liste
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Déplier la liste ({filteredEvaluatorSuggestions.filter((m) => m.role !== 'CMN_CANDIDATE').length})
                    </>
                  )}
                </Button>
              </div>

              {selectedCoEvaluatorIds.length > 0 && (
                <div className="flex flex-wrap gap-2 py-1">
                  {selectedCoEvaluatorIds.map((coId) => {
                    const mn = evaluatorsList.find((e) => e.id === coId);
                    if (!mn) return null;
                    return (
                      <span
                        key={coId}
                        className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900"
                      >
                        <span>
                          {mn.first_name} {mn.last_name}
                          {mn.febras_number ? ` (#${mn.febras_number})` : ''}
                        </span>
                        <button
                          type="button"
                          aria-label={`Retirer ${mn.first_name} ${mn.last_name}`}
                          onClick={() => removeCoEvaluator(coId)}
                          className="rounded-full p-0.5 text-sky-700 hover:bg-sky-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              <Input
                id="co-evaluator-search"
                placeholder="Taper un nom pour ajouter un co-examinateur MN (ou cliquez sur Déplier)..."
                value={coEvalSearchQuery}
                onChange={(e) => setCoEvalSearchQuery(e.target.value)}
                className="h-9 text-sm"
              />

              {/* Liste de puces compacte et déroulante, affichée uniquement sur recherche ou clic sur Déplier */}
              {(showCoEvalDirectory || coEvalSearchQuery.trim().length > 0) && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                  <div className="flex flex-wrap gap-1.5">
                    {filteredEvaluatorSuggestions
                      .filter((mn) => mn.role !== 'CMN_CANDIDATE')
                      .map((mn) => (
                        <button
                          key={mn.id}
                          type="button"
                          onClick={() => addCoEvaluator(mn.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-900"
                        >
                          <span>
                            + {mn.first_name} {mn.last_name}
                          </span>
                          {mn.febras_number && (
                            <span className="font-mono text-[10px] text-slate-400">
                              #{mn.febras_number}
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 3. Choix visuel par cartes claires des 10 épreuves réglementaires */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-sky-600" />
              <CardTitle className="text-base">
                3. Choix de l’Épreuve Réglementaire (10 épreuves)
              </CardTitle>
            </div>
            <CardDescription>
              Chaque carte indique le nombre exact de critères officiels à évaluer.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {OFFICIAL_EXAM_TYPES.map((exam) => {
              const count = criteriaList.filter(
                (c) => c.exam_code === exam.code && c.is_active
              ).length;
              const isSelected = exam.code === selectedExamCode;
              return (
                <button
                  key={exam.code}
                  type="button"
                  onClick={() => handleSelectExam(exam.code)}
                  className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? 'border-sky-600 bg-sky-600 text-white shadow-md'
                      : 'border-slate-200 bg-slate-50/70 text-slate-800 hover:border-sky-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        isSelected ? 'text-sky-200' : 'text-slate-400'
                      }`}
                    >
                      #{exam.display_order}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {count} questions
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-bold leading-snug">
                    {exam.short_title}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* 4. Grille d'évaluation dynamique regroupée par pilier de compétence */}
        <div className="space-y-4">
          {criteriaGroupedByPillar.map((group) => (
            <Card key={group.pillarCode} className="overflow-hidden border-slate-200">
              <CardHeader className="border-b bg-slate-900 py-3 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-sky-500 text-white">
                      {group.pillarCode}
                    </Badge>
                    <CardTitle className="text-sm font-bold text-white">
                      {group.pillarTitle}
                    </CardTitle>
                  </div>
                  <span className="text-xs text-slate-300">
                    {
                      group.items.filter(
                        (i) => gradesByCriterion[i.id] !== undefined
                      ).length
                    }{' '}
                    / {group.items.length} cotés
                  </span>
                </div>
              </CardHeader>

              <CardContent className="divide-y divide-slate-200 p-0">
                {group.items.map((criterion) => {
                  const selectedGrade = gradesByCriterion[criterion.id];
                  return (
                    <div key={criterion.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug text-slate-900">
                          <span className="mr-1.5 font-mono text-xs text-sky-700">
                            [{criterion.excel_col}]
                          </span>
                          {criterion.question_text}
                        </p>
                        {selectedGrade ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <Badge className="bg-slate-800 text-white">
                              {GRADE_LABELS[selectedGrade]}
                            </Badge>
                            <button
                              type="button"
                              onClick={() => handleClearGrade(criterion.id)}
                              title="Annuler cette cotation (remettre À coter)"
                              aria-label={`Annuler la cotation de la question ${criterion.excel_col}`}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-amber-300 bg-amber-50 text-amber-800"
                          >
                            À coter
                          </Badge>
                        )}
                      </div>

                      {/* 7 boutons tactiles larges et contrastés utilisables à une main (10, 8, 6, 4, 2, 1, NE) */}
                      <div
                        role="group"
                        aria-label={`Cotations pour la question ${criterion.excel_col}`}
                        className="grid grid-cols-7 gap-1 sm:gap-2"
                      >
                        {TACTILE_GRADE_BUTTONS.map((btn) => {
                          const isActive = selectedGrade === btn.code;
                          return (
                            <button
                              key={btn.code}
                              type="button"
                              onClick={() =>
                                handleSelectGrade(criterion.id, btn.code)
                              }
                              aria-pressed={isActive}
                              className={`flex min-h-[54px] flex-col items-center justify-center rounded-xl border px-1 py-2 text-center transition select-none active:scale-95 ${
                                isActive ? btn.activeClass : btn.inactiveClass
                              }`}
                            >
                              <span className="text-base font-extrabold tracking-tight">
                                {btn.label}
                              </span>
                              <span className="text-[10px] font-medium opacity-85">
                                {btn.pointsLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 5. Saisie vocale (fr-BE) et commentaires constructifs obligatoires */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              4. Débriefing Constructif Obligatoire & Dictée Vocale (fr-BE)
            </CardTitle>
            <CardDescription>
              Utilisez le bouton microphone pour dicter vos observations à chaud au
              sortir de l’eau (colonnes <code>DE</code> et <code>DD</code>).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Ce que le CMN doit garder (Colonne DE) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="strengths-textarea"
                  className="text-sm font-bold text-emerald-800"
                >
                  Ce que le CMN doit garder (Points forts — Col. DE) *
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant={strengthsDictation.isListening ? 'destructive' : 'outline'}
                  onClick={strengthsDictation.toggleListening}
                  className="h-8 text-xs"
                >
                  {strengthsDictation.isListening ? (
                    <>
                      <MicOff className="h-3.5 w-3.5 animate-pulse" />
                      <span>Arrêter la dictée (fr-BE)</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-3.5 w-3.5 text-emerald-700" />
                      <span>Dicter au micro</span>
                    </>
                  )}
                </Button>
              </div>
              <textarea
                id="strengths-textarea"
                rows={3}
                placeholder="Points forts observés durant la prestation (ex: briefing structuré, écoute attentive, sécurité irréprochable)..."
                value={strengthsComment}
                onChange={(e) => setStrengthsComment(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              {strengthsDictation.speechError && (
                <p className="text-xs text-amber-700">
                  {strengthsDictation.speechError}
                </p>
              )}
            </div>

            {/* Ce que le CMN doit améliorer (Colonne DD) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="improvements-textarea"
                  className="text-sm font-bold text-amber-800"
                >
                  Ce que le CMN doit améliorer (Axes de progression — Col. DD) *
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    improvementsDictation.isListening ? 'destructive' : 'outline'
                  }
                  onClick={improvementsDictation.toggleListening}
                  className="h-8 text-xs"
                >
                  {improvementsDictation.isListening ? (
                    <>
                      <MicOff className="h-3.5 w-3.5 animate-pulse" />
                      <span>Arrêter la dictée (fr-BE)</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-3.5 w-3.5 text-amber-700" />
                      <span>Dicter au micro</span>
                    </>
                  )}
                </Button>
              </div>
              <textarea
                id="improvements-textarea"
                rows={3}
                placeholder="Pistes concrètes d’amélioration pour le candidat..."
                value={improvementsComment}
                onChange={(e) => setImprovementsComment(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              {improvementsDictation.speechError && (
                <p className="text-xs text-amber-700">
                  {improvementsDictation.speechError}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Validation et verrouillage tant que tous les critères ne sont pas cotés */}
        <Card className="border-slate-300 bg-slate-900 text-white">
          <CardContent className="flex flex-col items-stretch justify-between gap-4 p-4 sm:flex-row sm:items-center">
            <div className="space-y-1 text-xs">
              {!allQuestionsAnswered ? (
                <div className="flex items-center gap-2 text-amber-300 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    Il reste{' '}
                    <strong>{totalQuestionsCount - answeredQuestionsCount}</strong>{' '}
                    question(s) sans choix explicite (utilisez <code>NE</code> si non
                    observé).
                  </span>
                </div>
              ) : !commentsValid ? (
                <div className="flex items-center gap-2 text-amber-300 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    Veuillez renseigner les deux commentaires constructifs (points à
                    garder et points à améliorer).
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Grille complète ({totalQuestionsCount}/{totalQuestionsCount}) —
                    Moyenne calculée : {liveExamAveragePreview.formattedAverage}
                  </span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit}
              className="w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400"
            >
              <Send className="h-4 w-4" />
              {submitting
                ? 'Enregistrement...'
                : 'Valider l’Évaluation Terrain'}
            </Button>
          </CardContent>
        </Card>
        </>
        )}
      </form>
    </div>
  );
}
