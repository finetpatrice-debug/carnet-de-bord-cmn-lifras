import React, { useMemo, useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useAuth } from '@/features/auth/AuthContext';
import { useAdminStore } from '@/features/admin/AdminStoreContext';
import {
  EXAM_PILLAR_MATRIX,
  OFFICIAL_CRITERIA,
  OFFICIAL_EXAM_TYPES,
  OFFICIAL_PILLARS,
} from '@/domain/referentials';
import { computeCandidateScoreboard } from '@/domain/scoringEngine';
import type {
  GradeCode,
  PillarCode,
  Profile,
} from '@/domain/types';
import { USER_ROLE_LABELS } from '@/domain/types';
import {
  buildEvaluatorCrossMatrix,
  buildPillarChronologicalSeries,
  getPillarStatusVisuals,
} from './dashboardAnalytics';
import { triggerOfficialPdfExport } from './pdfDeliberationExporter';
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
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  FileDown,
  Filter,
  Layers,
  MessageSquareQuote,
  Radar as RadarIcon,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';

type DashboardTab =
  | 'OVERVIEW_AND_PILLARS'
  | 'EXAMS_AND_JURIES'
  | 'COMMENTS_JOURNAL'
  | 'SUPERVISOR_COHORT';

function CircularScoreGauge({
  score,
  strokeColor,
}: {
  score: number;
  strokeColor: string;
}): React.ReactElement {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, score));
  const strokeDashoffset = circumference - clamped * circumference;

  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <svg className="h-16 w-16 -rotate-90 transform" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke="#e2e8f0"
          strokeWidth="6"
          fill="transparent"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke={strokeColor}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <span className="absolute text-xs font-extrabold text-slate-900">
        {score > 0 ? `${Math.round(score * 100)}%` : '—'}
      </span>
    </div>
  );
}

const GRADE_STACK_COLORS: Record<GradeCode, { bg: string; label: string }> = {
  TB: { bg: 'bg-emerald-600', label: 'TB' },
  B: { bg: 'bg-green-500', label: 'B' },
  S: { bg: 'bg-amber-500', label: 'S' },
  I: { bg: 'bg-orange-500', label: 'I' },
  M: { bg: 'bg-red-600', label: 'M' },
  NE: { bg: 'bg-slate-400', label: 'NE' },
};

interface CustomRadarTickProps {
  x?: number;
  y?: number;
  textAnchor?: 'start' | 'middle' | 'end' | 'inherit';
  payload?: {
    value: string;
  };
}

/**
 * Rendu personnalisé sur 2 lignes pour les libellés du Radar à 5 axes
 * afin que les textes longs ne soient jamais tronqués sur les bords du cadre.
 */
function renderWrappedRadarTick(
  props: CustomRadarTickProps
): React.ReactElement<SVGElement> {
  const { x = 0, y = 0, textAnchor = 'middle', payload } = props;
  const rawLabel = payload?.value ?? '';

  const MULTI_LINE_LABELS: Record<string, [string, string]> = {
    "Formateur d'instructeurs": ['Formateur', "d'instructeurs"],
    'Capacité de conception en groupe': ['Capacité de', 'conception en groupe'],
    'Connaissances théoriques': ['Connaissances', 'théoriques'],
  };

  const lines = MULTI_LINE_LABELS[rawLabel] ?? [rawLabel];

  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fill="#0f172a"
      fontSize={11}
      fontWeight={700}
    >
      {lines.map((line, index) => (
        <tspan
          key={index}
          x={x}
          dy={index === 0 ? (lines.length > 1 ? -4 : 3) : 14}
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}

export function DashboardPage(): React.ReactElement {
  const { profile } = useAuth();
  const { candidates, mnDirectory, evaluations, evaluationScores } =
    useAdminStore();

  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(
    () => candidates[0]?.id ?? 'cand-thomas-peeters'
  );
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    'OVERVIEW_AND_PILLARS'
  );
  const [selectedPillarCode, setSelectedPillarCode] =
    useState<PillarCode>('LEADERSHIP');

  // Filtres pour l'onglet Journal des Commentaires
  const [commentExamFilter, setCommentExamFilter] = useState<string>('ALL');
  const [commentEvaluatorFilter, setCommentEvaluatorFilter] =
    useState<string>('ALL');
  const [commentSearchQuery, setCommentSearchQuery] = useState<string>('');

  const activeCandidate: Profile = useMemo(
    () =>
      candidates.find((c) => c.id === selectedCandidateId) ??
      candidates[0],
    [candidates, selectedCandidateId]
  );

  // Évaluations du candidat actif
  const candidateEvaluations = useMemo(
    () =>
      evaluations.filter((ev) => ev.candidate_id === activeCandidate?.id),
    [evaluations, activeCandidate?.id]
  );

  // Calcul intégral du Tableau de Bord via scoringEngine.ts (Zéro calcul dans le composant)
  const scoreboard = useMemo(
    () =>
      computeCandidateScoreboard(
        candidateEvaluations,
        evaluationScores,
        OFFICIAL_CRITERIA,
        'ISO_EXCEL'
      ),
    [candidateEvaluations, evaluationScores]
  );

  // Données pour le Radar 5 axes (Recharts) avec seuil cible 60 % et excellence 80 %
  const radarData = useMemo(
    () =>
      OFFICIAL_PILLARS.map((pillar) => ({
        pillarTitle: pillar.title,
        candidat: Number(
          (scoreboard.globalPillarScores[pillar.code] * 100).toFixed(2)
        ),
        seuil60: 60,
        excellence80: 80,
      })),
    [scoreboard]
  );

  // Série chronologique pour le pilier sélectionné
  const selectedPillarMeta = useMemo(
    () =>
      OFFICIAL_PILLARS.find((p) => p.code === selectedPillarCode) ??
      OFFICIAL_PILLARS[0],
    [selectedPillarCode]
  );

  const chronologicalSeries = useMemo(
    () =>
      buildPillarChronologicalSeries(
        selectedPillarCode,
        candidateEvaluations,
        evaluationScores,
        OFFICIAL_CRITERIA
      ),
    [selectedPillarCode, candidateEvaluations, evaluationScores]
  );

  // Matrice croisée des examinateurs
  const evaluatorMatrix = useMemo(
    () => buildEvaluatorCrossMatrix(candidateEvaluations, mnDirectory),
    [candidateEvaluations, mnDirectory]
  );

  // Timeline filtrée du Journal des Commentaires (sans lignes vides "00:00")
  const filteredCommentsTimeline = useMemo(() => {
    const q = commentSearchQuery.trim().toLowerCase();
    return candidateEvaluations
      .filter((ev) => ev.status === 'PUBLISHED')
      .filter((ev) => {
        const hasKeep =
          ev.strengths_comment.trim().length > 0 &&
          ev.strengths_comment.trim() !== '00:00';
        const hasImprove =
          ev.improvements_comment.trim().length > 0 &&
          ev.improvements_comment.trim() !== '00:00';
        return hasKeep || hasImprove;
      })
      .filter((ev) =>
        commentExamFilter === 'ALL' ? true : ev.exam_code === commentExamFilter
      )
      .filter((ev) => {
        if (commentEvaluatorFilter === 'ALL') return true;
        const mn = mnDirectory.find((m) => m.id === commentEvaluatorFilter);
        if (!mn) return true;
        return (
          ev.lead_evaluator_id === mn.id ||
          (ev.legacy_evaluator_raw ?? '')
            .toLowerCase()
            .includes(mn.last_name.toLowerCase())
        );
      })
      .filter((ev) => {
        if (!q) return true;
        return (
          ev.strengths_comment.toLowerCase().includes(q) ||
          ev.improvements_comment.toLowerCase().includes(q) ||
          (ev.legacy_evaluator_raw ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.event_date.localeCompare(a.event_date));
  }, [
    candidateEvaluations,
    commentExamFilter,
    commentEvaluatorFilter,
    commentSearchQuery,
    mnDirectory,
  ]);

  // Données comparatives multi-candidats pour la Vue Superviseur DTF
  const cohortComparisonRows = useMemo(() => {
    const preStageFinalExams = OFFICIAL_EXAM_TYPES.filter(
      (e) => e.code !== 'STAGE_FINAL'
    );
    return candidates.map((cand) => {
      const candEvals = evaluations.filter((ev) => ev.candidate_id === cand.id);
      const sb = computeCandidateScoreboard(
        candEvals,
        evaluationScores,
        OFFICIAL_CRITERIA,
        'ISO_EXCEL'
      );
      const missingBeforeStageFinal = preStageFinalExams.filter(
        (ex) => sb.exams[ex.code].evaluationCount === 0
      );
      return {
        candidate: cand,
        scoreboard: sb,
        missingBeforeStageFinal,
      };
    });
  }, [candidates, evaluations, evaluationScores]);

  const handleExportPdf = (): void => {
    if (!activeCandidate) return;
    triggerOfficialPdfExport({
      candidate: activeCandidate,
      scoreboard,
      evaluations: candidateEvaluations,
      evaluatorMatrix,
    });
  };

  if (!activeCandidate) {
    return <div className="p-6">Aucun candidat disponible.</div>;
  }

  const initials = `${activeCandidate.first_name.charAt(0)}${activeCandidate.last_name.charAt(0)}`.toUpperCase();

  return (
    <div className="space-y-6">
      {/* 1. En-tête Identitaire CMN + Sélecteur de candidat + Bouton Export PDF Officiel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            {activeCandidate.photo_storage_path ? (
              <img
                src={activeCandidate.photo_storage_path}
                alt={`${activeCandidate.first_name} ${activeCandidate.last_name}`}
                className="h-16 w-16 shrink-0 rounded-2xl border-2 border-sky-500 object-cover shadow"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-slate-900 text-xl font-extrabold text-white shadow">
                {initials}
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">
                  {activeCandidate.first_name} {activeCandidate.last_name}
                </h1>
                <Badge className="bg-sky-600 text-white">
                  FEBRAS #{activeCandidate.febras_number ?? 'N/A'}
                </Badge>
                {profile && (
                  <Badge variant="outline">
                    Vue : {USER_ROLE_LABELS[profile.role]}
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span>
                  Club : <strong>{activeCandidate.club_name ?? '—'}</strong>
                </span>
                <span>•</span>
                <span>
                  Plongées : <strong>{activeCandidate.dives_count ?? 0}</strong>
                </span>
                <span>•</span>
                <span>
                  CFPS : <strong>{activeCandidate.cfps_year ?? '—'}</strong> / MF :{' '}
                  <strong>{activeCandidate.mf_year ?? '—'}</strong>
                </span>
                <span>•</span>
                <span className="font-semibold text-emerald-700">
                  {scoreboard.totalPublishedEvaluations} évaluations validées
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {profile?.role !== 'CMN_CANDIDATE' && (
              <select
                aria-label="Sélectionner le candidat CMN"
                value={selectedCandidateId}
                onChange={(e) => setSelectedCandidateId(e.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    Candidat : {c.first_name} {c.last_name} ({c.club_name})
                  </option>
                ))}
              </select>
            )}

            <Button
              type="button"
              onClick={handleExportPdf}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              <FileDown className="h-4 w-4 text-sky-400" />
              Exporter le Dossier Officiel PDF
            </Button>
          </div>
        </div>

        {/* Barre d'onglets du Cockpit Analytique */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab('OVERVIEW_AND_PILLARS')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'OVERVIEW_AND_PILLARS'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Award className="h-4 w-4" />
            <span>Cockpit 5 Piliers & Radar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('EXAMS_AND_JURIES')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'EXAMS_AND_JURIES'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Récapitulatif par Épreuve & Matrice des Jurys</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COMMENTS_JOURNAL')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'COMMENTS_JOURNAL'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <MessageSquareQuote className="h-4 w-4" />
            <span>
              Journal des Commentaires ({filteredCommentsTimeline.length})
            </span>
          </button>

          {profile?.role === 'ADMIN_DTF' && (
            <button
              type="button"
              onClick={() => setActiveTab('SUPERVISOR_COHORT')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                activeTab === 'SUPERVISOR_COHORT'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Vue Superviseur DTF (Comparatif Cohorte)</span>
            </button>
          )}
        </div>
      </div>

      {/* ONGLET 1 : COCKPIT 5 TUILES MAITRESSES + RADAR 5 AXES + VUE DETAILLEE PAR PILIER */}
      {activeTab === 'OVERVIEW_AND_PILLARS' && (
        <div className="space-y-6">
          {/* Les 5 Tuiles Maîtresses cliquables avec jauge circulaire et code couleur */}
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            {OFFICIAL_PILLARS.map((pillar) => {
              const score = scoreboard.globalPillarScores[pillar.code];
              const formatted =
                scoreboard.formattedGlobalPillarScores[pillar.code];
              const visuals = getPillarStatusVisuals(score);
              const isSelected = selectedPillarCode === pillar.code;

              return (
                <button
                  key={pillar.code}
                  type="button"
                  onClick={() => setSelectedPillarCode(pillar.code)}
                  className={`flex flex-col justify-between rounded-xl border-2 bg-white p-4 text-left transition shadow-sm ${
                    isSelected
                      ? 'ring-2 ring-sky-500 border-sky-600'
                      : visuals.borderCardClass
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Pilier #{pillar.display_order}
                      </span>
                      <h3 className="mt-0.5 text-sm font-bold leading-snug text-slate-900">
                        {pillar.title}
                      </h3>
                    </div>
                    <CircularScoreGauge
                      score={score}
                      strokeColor={visuals.strokeColor}
                    />
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div
                      className={`text-xl font-extrabold ${visuals.textColorClass}`}
                    >
                      {formatted}
                    </div>
                    <span
                      className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${visuals.bgBadgeClass}`}
                    >
                      {visuals.levelLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Grille 2 colonnes : Radar à 5 axes + Vue détaillée du Pilier sélectionné */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Radar à 5 axes (Recharts) superposant profil, seuil 60 % et excellence 80 % */}
            <Card className="lg:col-span-5">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-sky-700">
                  <RadarIcon className="h-5 w-5" />
                  <CardTitle className="text-base">
                    Profil Radar à 5 Axes (Iso-Excel)
                  </CardTitle>
                </div>
                <CardDescription>
                  Superposition du profil actuel avec le seuil cible (60 %) et le
                  seuil d’excellence (80 %).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius="58%"
                      margin={{ top: 18, right: 44, bottom: 18, left: 44 }}
                      data={radarData}
                    >
                      <PolarGrid stroke="#cbd5e1" />
                      <PolarAngleAxis
                        dataKey="pillarTitle"
                        tick={renderWrappedRadarTick}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fontSize: 10 }}
                      />
                      <Radar
                        name="Seuil cible (60 %)"
                        dataKey="seuil60"
                        stroke="#d97706"
                        fill="#f59e0b"
                        fillOpacity={0.08}
                        strokeDasharray="4 4"
                      />
                      <Radar
                        name="Excellence (80 %)"
                        dataKey="excellence80"
                        stroke="#059669"
                        fill="#10b981"
                        fillOpacity={0.08}
                        strokeDasharray="3 3"
                      />
                      <Radar
                        name={`${activeCandidate.first_name} ${activeCandidate.last_name}`}
                        dataKey="candidat"
                        stroke="#0284c7"
                        strokeWidth={2.5}
                        fill="#0284c7"
                        fillOpacity={0.35}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Vue détaillée du Pilier sélectionné (équivalent enrichi des 5 onglets thématiques) */}
            <Card className="lg:col-span-7">
              <CardHeader className="border-b bg-slate-50/80 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-sky-600" />
                    <CardTitle className="text-lg">
                      Pilier #{selectedPillarMeta.display_order} —{' '}
                      {selectedPillarMeta.title}
                    </CardTitle>
                  </div>
                  <Badge className="bg-sky-600 text-sm text-white">
                    Moyenne globale :{' '}
                    {
                      scoreboard.formattedGlobalPillarScores[
                        selectedPillarMeta.code
                      ]
                    }
                  </Badge>
                </div>
                <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50/70 p-3 text-xs leading-relaxed text-sky-950">
                  <strong>Définition officielle LIFRAS :</strong>{' '}
                  {selectedPillarMeta.official_description}
                </p>
              </CardHeader>

              <CardContent className="space-y-5 pt-4">
                {/* Tableau des activités examinées rattachées à ce pilier */}
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Activités examinées rattachées à ce pilier
                  </h4>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b bg-slate-50 font-semibold text-slate-600">
                          <th className="px-3 py-2">Épreuve</th>
                          <th className="px-3 py-2 text-center">Évaluations</th>
                          <th className="px-3 py-2 text-center">
                            Items cotés (J) / Points (K)
                          </th>
                          <th className="px-3 py-2 text-right">
                            Moyenne du Pilier (L)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {OFFICIAL_EXAM_TYPES.filter((ex) =>
                          EXAM_PILLAR_MATRIX[ex.code].includes(
                            selectedPillarMeta.code
                          )
                        ).map((exam) => {
                          const exSummary = scoreboard.exams[exam.code];
                          const cell =
                            exSummary.pillars[selectedPillarMeta.code];
                          return (
                            <tr key={exam.code} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-medium text-slate-900">
                                {exam.short_title}
                              </td>
                              <td className="px-3 py-2 text-center font-semibold">
                                {exSummary.evaluationCount}
                              </td>
                              <td className="px-3 py-2 text-center font-mono text-slate-600">
                                {cell ? `${cell.J} items (${cell.K} pts)` : '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-sky-700">
                                {cell?.formattedScore ?? 'Non évalué'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Graphique d'évolution chronologique des prestations du pilier */}
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <TrendingUp className="h-4 w-4 text-sky-600" />
                    <span>
                      Évolution chronologique des prestations ({chronologicalSeries.length})
                    </span>
                  </div>
                  {chronologicalSeries.length === 0 ? (
                    <p className="rounded-lg border bg-slate-50 p-4 text-xs text-slate-500">
                      Aucune prestation cotée enregistrée pour ce pilier.
                    </p>
                  ) : (
                    <div className="h-52 w-full rounded-lg border bg-white p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chronologicalSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis
                            dataKey="eventDate"
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="scorePercent"
                            name="Score Pilier (%)"
                            stroke="#0284c7"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: '#0284c7' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ONGLET 2 : RECAPITULATIF PAR EPREUVE (10 CARTES + HISTOGRAMME EMPILE) & MATRICE DES JURYS */}
      {activeTab === 'EXAMS_AND_JURIES' && (
        <div className="space-y-6">
          {/* Les 10 cartes d'épreuves avec histogramme empilé TB/B/S/I/M/NE */}
          <div className="grid gap-4 md:grid-cols-2">
            {OFFICIAL_EXAM_TYPES.map((exam) => {
              const exSummary = scoreboard.exams[exam.code];
              const isEvaluated = exSummary.examAverage !== null;
              const attachedPillars = EXAM_PILLAR_MATRIX[exam.code];

              return (
                <Card key={exam.code} className="border-slate-200">
                  <CardHeader className="border-b bg-slate-50/70 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                          Épreuve #{exam.display_order} • {exSummary.evaluationCount}{' '}
                          évaluation(s)
                        </span>
                        <CardTitle className="text-base text-slate-900">
                          {exam.short_title}
                        </CardTitle>
                      </div>
                      {isEvaluated ? (
                        <Badge className="bg-sky-600 text-sm text-white">
                          {exSummary.formattedExamAverage}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Non évalué
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-4">
                    {attachedPillars.map((pCode) => {
                      const cell = exSummary.pillars[pCode];
                      if (!cell) return null;
                      const totalItemsWithNe = cell.J + cell.counts.NE;

                      return (
                        <div key={pCode} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700">
                              {pCode}
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              {cell.formattedScore}
                            </span>
                          </div>

                          {/* Histogramme empilé TB / B / S / I / M / NE */}
                          {totalItemsWithNe > 0 ? (
                            <div className="space-y-1">
                              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                                {(
                                  ['TB', 'B', 'S', 'I', 'M', 'NE'] as GradeCode[]
                                ).map((g) => {
                                  const count = cell.counts[g];
                                  if (count <= 0) return null;
                                  const pct = (count / totalItemsWithNe) * 100;
                                  return (
                                    <div
                                      key={g}
                                      style={{ width: `${pct}%` }}
                                      className={GRADE_STACK_COLORS[g].bg}
                                      title={`${g} : ${count}`}
                                    />
                                  );
                                })}
                              </div>
                              <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                                {(
                                  ['TB', 'B', 'S', 'I', 'M', 'NE'] as GradeCode[]
                                ).map((g) =>
                                  cell.counts[g] > 0 ? (
                                    <span key={g} className="font-mono">
                                      <strong>{g}:</strong> {cell.counts[g]}
                                    </span>
                                  ) : null
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] italic text-slate-400">
                              Aucune cotation enregistrée
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Matrice Croisée des Examinateurs (Moniteurs Nationaux × 10 Épreuves) */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sky-700">
                <Users className="h-5 w-5" />
                <CardTitle className="text-base">
                  Matrice Croisée des Examinateurs (Diversité des Jurys MN)
                </CardTitle>
              </div>
              <CardDescription>
                Lignes = Moniteurs Nationaux normalisés • Colonnes = les 10
                épreuves réglementaires • Totaux marginaux de contrôle pour le DTF
                et le Parrain.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-slate-900 text-white">
                      <th className="px-3 py-2.5">Moniteur National (MN)</th>
                      {OFFICIAL_EXAM_TYPES.map((ex) => (
                        <th
                          key={ex.code}
                          className="px-2 py-2.5 text-center text-[10px]"
                          title={ex.short_title}
                        >
                          {ex.short_title}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-center font-bold text-sky-300">
                        Total MN
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {evaluatorMatrix.rows.map((row) => (
                      <tr key={row.mnProfile.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          {row.mnProfile.first_name} {row.mnProfile.last_name}{' '}
                          <span className="font-mono text-[10px] text-slate-400">
                            (#{row.mnProfile.febras_number})
                          </span>
                        </td>
                        {OFFICIAL_EXAM_TYPES.map((ex) => {
                          const c = row.countsByExam[ex.code];
                          return (
                            <td key={ex.code} className="px-2 py-2 text-center">
                              {c > 0 ? (
                                <Badge className="bg-sky-600 text-white">
                                  {c}
                                </Badge>
                              ) : (
                                <span className="text-slate-300">·</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-mono font-bold text-slate-900">
                          {row.totalForEvaluator}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-slate-100 font-bold text-slate-900">
                      <td className="px-3 py-2">Total interventions jury</td>
                      {OFFICIAL_EXAM_TYPES.map((ex) => (
                        <td key={ex.code} className="px-2 py-2 text-center">
                          {evaluatorMatrix.columnTotals[ex.code]}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center text-sky-700">
                        {evaluatorMatrix.grandTotal}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ONGLET 3 : JOURNAL DES COMMENTAIRES DYNAMIQUE (TIMELINE SANS LIGNES VIDES) */}
      {activeTab === 'COMMENTS_JOURNAL' && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  Journal Chronologique des Commentaires Pédagogiques
                </CardTitle>
                <CardDescription>
                  Timeline épurée (sans lignes vides <code>00:00</code>), filtrable
                  par épreuve, par examinateur MN ou par recherche plein texte.
                </CardDescription>
              </div>
              <Badge variant="secondary">
                {filteredCommentsTimeline.length} prestation(s) commentée(s)
              </Badge>
            </div>

            {/* Barre de filtres */}
            <div className="mt-3 grid gap-3 pt-2 sm:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Rechercher un mot-clé (ex: briefing, sécurité)..."
                  value={commentSearchQuery}
                  onChange={(e) => setCommentSearchQuery(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 shrink-0 text-slate-400" />
                <select
                  aria-label="Filtrer par épreuve"
                  value={commentExamFilter}
                  onChange={(e) => setCommentExamFilter(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800"
                >
                  <option value="ALL">Toutes les épreuves (10)</option>
                  {OFFICIAL_EXAM_TYPES.map((ex) => (
                    <option key={ex.code} value={ex.code}>
                      {ex.short_title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  aria-label="Filtrer par examinateur MN"
                  value={commentEvaluatorFilter}
                  onChange={(e) => setCommentEvaluatorFilter(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800"
                >
                  <option value="ALL">Tous les examinateurs MN</option>
                  {mnDirectory.map((mn) => (
                    <option key={mn.id} value={mn.id}>
                      {mn.first_name} {mn.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {filteredCommentsTimeline.length === 0 ? (
              <div className="rounded-xl border bg-slate-50 p-8 text-center text-sm text-slate-500">
                Aucun commentaire ne correspond aux filtres sélectionnés.
              </div>
            ) : (
              filteredCommentsTimeline.map((ev) => {
                const examTitle =
                  OFFICIAL_EXAM_TYPES.find((e) => e.code === ev.exam_code)
                    ?.short_title ?? ev.exam_code;
                return (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-slate-900 text-white">
                          {ev.event_date}
                        </Badge>
                        <Badge variant="secondary">{examTitle}</Badge>
                      </div>
                      <span className="text-xs font-semibold text-slate-600">
                        Jury MN : {ev.legacy_evaluator_raw ?? 'Non spécifié'}
                      </span>
                    </div>

                    {/* Deux colonnes distinctives côte à côte : À garder (vert) et À améliorer (ambre) */}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border-l-4 border-l-emerald-600 bg-emerald-50/50 p-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                          À garder (Points forts — Col. DE)
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-800">
                          {ev.strengths_comment || '—'}
                        </p>
                      </div>

                      <div className="rounded-lg border-l-4 border-l-amber-500 bg-amber-50/50 p-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                          À améliorer (Axes de progression — Col. DD)
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-800">
                          {ev.improvements_comment || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* ONGLET 4 : VUE SUPERVISEUR DTF (COMPARATIF MULTI-CANDIDATS DE LA COHORTE) */}
      {activeTab === 'SUPERVISOR_COHORT' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sky-700">
              <Users className="h-5 w-5" />
              <CardTitle className="text-base">
                Vue Superviseur DTF — Tableau Comparatif de la Cohorte CMN_2026
              </CardTitle>
            </div>
            <CardDescription>
              Synthèse multi-candidats des 5 piliers, volume d’évaluations et
              détection automatique des épreuves manquantes avant l’admission au
              Stage Final.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-slate-900 text-white">
                    <th className="px-3 py-2.5">Candidat CMN</th>
                    <th className="px-3 py-2.5 text-center">Évals</th>
                    <th className="px-3 py-2.5 text-right">Leadership</th>
                    <th className="px-3 py-2.5 text-right">Formateur</th>
                    <th className="px-3 py-2.5 text-right">Conception</th>
                    <th className="px-3 py-2.5 text-right">Connaissances</th>
                    <th className="px-3 py-2.5 text-right">Organisateur</th>
                    <th className="px-3 py-2.5">
                      Contrôle pré-Stage Final (9 épreuves préalables)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cohortComparisonRows.map((row) => (
                    <tr key={row.candidate.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCandidateId(row.candidate.id);
                            setActiveTab('OVERVIEW_AND_PILLARS');
                          }}
                          className="text-left font-bold text-sky-700 hover:underline"
                        >
                          {row.candidate.first_name} {row.candidate.last_name}
                        </button>
                        <div className="text-[11px] text-slate-500">
                          {row.candidate.club_name} • FEBRAS #
                          {row.candidate.febras_number}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-bold">
                        {row.scoreboard.totalPublishedEvaluations}
                      </td>
                      {OFFICIAL_PILLARS.map((p) => (
                        <td
                          key={p.code}
                          className="px-3 py-3 text-right font-mono font-semibold"
                        >
                          {row.scoreboard.formattedGlobalPillarScores[p.code]}
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        {row.missingBeforeStageFinal.length === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-900">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Cursus préalable complet (9/9) — Prêt Stage Final
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                              {row.missingBeforeStageFinal.length} épreuve(s)
                              manquante(s)
                            </span>
                            <div className="text-[10px] text-slate-500">
                              Manquant :{' '}
                              {row.missingBeforeStageFinal
                                .map((e) => e.short_title)
                                .join(', ')}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
