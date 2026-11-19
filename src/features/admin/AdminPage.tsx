import React, { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { isCreatorAccount, useAdminStore } from './AdminStoreContext';
import {
  buildCriterionMappingProposals,
  executeExamReclassification,
} from './reclassificationService';
import { OFFICIAL_CRITERIA, OFFICIAL_EXAM_TYPES } from '@/domain/referentials';
import type {
  AuditLog,
  Evaluation,
  ExamCode,
  GradeCode,
  Profile,
  UserRole,
} from '@/domain/types';
import { GRADE_LABELS, USER_ROLE_LABELS } from '@/domain/types';
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
  ArrowRightLeft,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileWarning,
  History,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

const GRADES_LIST: GradeCode[] = ['TB', 'B', 'S', 'I', 'M', '1', 'NE'];

export function AdminPage(): React.ReactElement {
  const { profile: activeAdmin } = useAuth();
  const {
    mnDirectory,
    candidates,
    evaluations,
    evaluationScores,
    auditLogs,
    archivedProfiles,
    addAliasToMn,
    applyReclassification,
    createCandidateProfile,
    updateProfileRole,
    updateFullProfile,
    deleteProfile,
    restoreProfile,
    purgeArchivedProfile,
    clearAuditLogs,
  } = useAdminStore();

  const isCreator = isCreatorAccount(activeAdmin?.email, activeAdmin?.id);

  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  const [newUserRole, setNewUserRole] = useState<UserRole>('CMN_CANDIDATE');

  // État pour l'inscription directe d'un nouveau Candidat Moniteur National (CMN)
  const [showNewCandidateForm, setShowNewCandidateForm] = useState(false);
  const [newCandLastName, setNewCandLastName] = useState('');
  const [newCandFirstName, setNewCandFirstName] = useState('');
  const [newCandEmail, setNewCandEmail] = useState('');
  const [newCandFebras, setNewCandFebras] = useState('');
  const [newCandGsm, setNewCandGsm] = useState('');
  const [newCandClub, setNewCandClub] = useState('');
  const [newCandDives, setNewCandDives] = useState('500');
  const [newCandCfpsYear, setNewCandCfpsYear] = useState('2020');
  const [newCandMfYear, setNewCandMfYear] = useState('2023');
  const [newCandPhotoDataUrl, setNewCandPhotoDataUrl] = useState<string | null>(null);
  const [candidateCreatedMsg, setCandidateCreatedMsg] = useState<string | null>(null);

  const handlePhotoFileToDataUrl = (
    file: File,
    onLoaded: (dataUrl: string) => void
  ): void => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const rawDataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        try {
          const MAX_DIM = 256;
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width >= height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            onLoaded(rawDataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          onLoaded(compressed);
        } catch {
          onLoaded(rawDataUrl);
        }
      };
      img.onerror = () => {
        onLoaded(rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleCreateCandidate = (e: React.FormEvent): void => {
    e.preventDefault();
    const nowIso = new Date().toISOString();
    const newId = `cand-${newCandLastName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

    const candidateProfile: Profile = {
      id: newId,
      role: newUserRole,
      cohort_id: 'cohort-2026',
      sponsor_mn_id: null,
      last_name: newCandLastName.trim(),
      first_name: newCandFirstName.trim(),
      birth_date: null,
      street_address: null,
      postal_code: null,
      city: null,
      phone_landline: null,
      phone_gsm: newCandGsm.trim() || null,
      email: newCandEmail.trim(),
      febras_number: newCandFebras.trim() || null,
      cfps_year: Number.parseInt(newCandCfpsYear, 10) || null,
      mf_year: Number.parseInt(newCandMfYear, 10) || null,
      dives_count: Number.parseInt(newCandDives, 10) || 0,
      club_name: newCandClub.trim() || null,
      club_president: null,
      club_head_instructor: null,
      club_head_gsm: null,
      photo_storage_path: newCandPhotoDataUrl,
      aliases: [`${newCandLastName.trim()} ${newCandFirstName.trim()}`],
      created_at: nowIso,
      updated_at: nowIso,
    };

    const auditLog: AuditLog = {
      id: `audit-cand-${Date.now()}`,
      actor_id: activeAdmin?.id ?? 'admin-dtf',
      entity_type: 'profiles',
      entity_id: newId,
      action: 'CREATE_CMN_CANDIDATE',
      previous_value: null,
      new_value: {
        name: `${candidateProfile.first_name} ${candidateProfile.last_name}`,
        febras_number: candidateProfile.febras_number,
        club_name: candidateProfile.club_name,
        sponsor_mn_id: candidateProfile.sponsor_mn_id,
      },
      reason: `Inscription administrative du nouveau CMN ${candidateProfile.first_name} ${candidateProfile.last_name} dans la cohorte CMN_2026`,
      created_at: nowIso,
    };

    createCandidateProfile({ candidateProfile, auditLog });
    setCandidateCreatedMsg(
      `Le candidat CMN ${candidateProfile.first_name} ${candidateProfile.last_name} (FEBRAS #${candidateProfile.febras_number ?? 'N/A'}) a été inscrit dans la cohorte CMN_2026.`
    );
    setNewCandLastName('');
    setNewCandFirstName('');
    setNewCandEmail('');
    setNewCandFebras('');
    setNewCandGsm('');
    setNewCandClub('');
    setNewCandPhotoDataUrl(null);
    setShowNewCandidateForm(false);
  };

  // État pour l'ajout d'alias sur un profil MN
  const [aliasInputs, setAliasInputs] = useState<Record<string, string>>({});

  // Affichage du Journal d'Audit : 'collapsed' (replié par défaut), 'compact' (hauteur limitée), 'expanded' (agrandi)
  const [auditViewSize, setAuditViewSize] = useState<'collapsed' | 'compact' | 'expanded'>('collapsed');

  // État pour la modale de reclassement traçable d'une épreuve mal aiguillée
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(
    null
  );
  const [targetExamCode, setTargetExamCode] = useState<ExamCode>('PEDA_AM_MC');
  const [mappedGrades, setMappedGrades] = useState<Record<number, GradeCode>>({});
  const [reclassifyReason, setReclassifyReason] = useState<string>('');
  const [reclassifyError, setReclassifyError] = useState<string | null>(null);
  const [reclassifySuccess, setReclassifySuccess] = useState<string | null>(null);

  const openReclassifyModal = (ev: Evaluation): void => {
    setSelectedEvaluation(ev);
    setReclassifyError(null);
    setReclassifySuccess(null);

    const defaultTarget: ExamCode =
      ev.exam_code === 'COURS_MF' ? 'PEDA_AM_MC' : 'COURS_MF';
    initializeTargetMapping(ev, defaultTarget);
  };

  const initializeTargetMapping = (
    ev: Evaluation,
    newTargetExam: ExamCode
  ): void => {
    setTargetExamCode(newTargetExam);
    const currentScores = evaluationScores.filter(
      (sc) => sc.evaluation_id === ev.id
    );
    const proposals = buildCriterionMappingProposals(
      ev.exam_code,
      newTargetExam,
      currentScores,
      OFFICIAL_CRITERIA
    );

    const initialTargetGrades: Record<number, GradeCode> = {};
    const targetCriteria = OFFICIAL_CRITERIA.filter(
      (c) => c.exam_code === newTargetExam && c.is_active
    );
    for (const tc of targetCriteria) {
      initialTargetGrades[tc.id] = 'NE';
    }

    for (const prop of proposals) {
      if (prop.suggestedTargetCriterion) {
        initialTargetGrades[prop.suggestedTargetCriterion.id] = prop.sourceGrade;
      }
    }

    setMappedGrades(initialTargetGrades);
  };

  const handleConfirmReclassification = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!selectedEvaluation) return;

    try {
      const currentScores = evaluationScores.filter(
        (sc) => sc.evaluation_id === selectedEvaluation.id
      );

      const res = executeExamReclassification(
        {
          evaluation: selectedEvaluation,
          currentScores,
          targetExamCode,
          mappedTargetGrades: mappedGrades,
          actorId: activeAdmin?.id ?? 'admin-dtf',
          reason: reclassifyReason,
        },
        OFFICIAL_CRITERIA
      );

      applyReclassification(res);
      setReclassifySuccess(
        `L'évaluation #${selectedEvaluation.legacy_row_id ?? selectedEvaluation.id} a été reclassée de ${selectedEvaluation.exam_code} vers ${targetExamCode} et journalisée dans audit_logs.`
      );
      setSelectedEvaluation(null);
      setReclassifyReason('');
    } catch (err) {
      setReclassifyError(
        err instanceof Error ? err.message : 'Erreur lors du reclassement.'
      );
    }
  };

  const getCandidateName = (candId: string): string => {
    const c = candidates.find((p) => p.id === candId);
    return c ? `${c.first_name} ${c.last_name}` : candId;
  };

  const getExamTitle = (code: ExamCode): string => {
    return (
      OFFICIAL_EXAM_TYPES.find((e) => e.code === code)?.short_title ?? code
    );
  };

  return (
    <div className="space-y-6">
      {/* Bannière principale */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sky-700">
              <Shield className="h-5 w-5" />
              <CardTitle>
                Administration DTF — Inscription CMN, Reclassement d’Épreuves, Annuaire MN & Audit Immuable
              </CardTitle>
            </div>
            <Button
              type="button"
              onClick={() => setShowNewCandidateForm((prev) => !prev)}
              className="bg-sky-600 text-white hover:bg-sky-700"
            >
              <UserPlus className="h-4 w-4" />
              {showNewCandidateForm
                ? 'Fermer le formulaire'
                : 'Inscrire un nouveau profil'}
            </Button>
          </div>
          <CardDescription>
            Module réservé exclusivement au rôle <strong>ADMIN_DTF</strong>. Aucune
            suppression physique d’évaluation publiée : toute correction d’aiguillage
            exige un motif explicite et écrit une trace avant/après en JSONB dans{' '}
            <code>audit_logs</code>.
          </CardDescription>
        </CardHeader>
        {(reclassifySuccess || candidateCreatedMsg) && (
          <CardContent className="space-y-2">
            {candidateCreatedMsg && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span>{candidateCreatedMsg}</span>
              </div>
            )}
            {reclassifySuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span>{reclassifySuccess}</span>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Formulaire d'inscription directe d'un nouveau Candidat Moniteur National */}
      {showNewCandidateForm && (
        <Card className="border-sky-300 bg-sky-50/40">
          <CardHeader>
            <div className="flex items-center gap-2 text-sky-800">
              <UserPlus className="h-5 w-5" />
              <CardTitle className="text-base">
                Inscription Manuelle d’un Nouveau Profil (Cohorte CMN_2026)
              </CardTitle>
            </div>
            <CardDescription>
              Renseignez la fiche signalétique du profil (les numéros GSM et FEBRAS sont
              stockés en <code>TEXT</code> afin de préserver le zéro initial).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreateCandidate}
              className="grid gap-4 sm:grid-cols-3"
            >
              <div>
                <label className="text-xs font-semibold text-sky-800">
                  Rôle / Habilitation *
                </label>
                <select
                  aria-label="Rôle du nouvel utilisateur"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="mt-1 flex h-9 w-full rounded-md border border-sky-300 bg-white px-3 text-xs font-bold text-slate-900"
                >
                  {(
                    [
                      'CMN_CANDIDATE',
                      'MN_EVALUATOR',
                      'ADMIN_DTF',
                    ] as UserRole[]
                  ).map((r) => (
                    <option key={r} value={r}>
                      {USER_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Nom *
                </label>
                <Input
                  required
                  placeholder="Ex: Janssens"
                  value={newCandLastName}
                  onChange={(e) => setNewCandLastName(e.target.value)}
                  className="mt-1 bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Prénom *
                </label>
                <Input
                  required
                  placeholder="Ex: David"
                  value={newCandFirstName}
                  onChange={(e) => setNewCandFirstName(e.target.value)}
                  className="mt-1 bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  E-mail officiel *
                </label>
                <Input
                  required
                  type="email"
                  placeholder="david.janssens@lifras.be"
                  value={newCandEmail}
                  onChange={(e) => setNewCandEmail(e.target.value)}
                  className="mt-1 bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  N° Matricule FEBRAS (TEXT) *
                </label>
                <Input
                  required
                  placeholder="Ex: 0065432"
                  value={newCandFebras}
                  onChange={(e) => setNewCandFebras(e.target.value)}
                  className="mt-1 bg-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Téléphone GSM belge (TEXT) *
                </label>
                <Input
                  required
                  placeholder="Ex: 0475112233"
                  value={newCandGsm}
                  onChange={(e) => setNewCandGsm(e.target.value)}
                  className="mt-1 bg-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Club affilié LIFRAS *
                </label>
                <Input
                  required
                  placeholder="Ex: Bruxelles Plongée"
                  value={newCandClub}
                  onChange={(e) => setNewCandClub(e.target.value)}
                  className="mt-1 bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Année CFPS / Année MF
                </label>
                <div className="mt-1 flex gap-2">
                  <Input
                    type="number"
                    placeholder="CFPS"
                    value={newCandCfpsYear}
                    onChange={(e) => setNewCandCfpsYear(e.target.value)}
                    className="bg-white"
                  />
                  <Input
                    type="number"
                    placeholder="MF"
                    value={newCandMfYear}
                    onChange={(e) => setNewCandMfYear(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Nombre de plongées
                </label>
                <Input
                  type="number"
                  value={newCandDives}
                  onChange={(e) => setNewCandDives(e.target.value)}
                  className="mt-1 bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Photo du profil (Tous rôles)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  {newCandPhotoDataUrl && (
                    <img
                      src={newCandPhotoDataUrl}
                      alt="Aperçu profil"
                      className="h-9 w-9 rounded-full border border-sky-400 object-cover"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Choisir une photo de profil"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handlePhotoFileToDataUrl(file, setNewCandPhotoDataUrl);
                      }
                    }}
                    className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-sky-600 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-sky-700"
                  />
                </div>
              </div>
              <div className="sm:col-span-3 flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewCandidateForm(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Enregistrer le nouveau profil
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 1. Outil de reclassement traçable d'une épreuve mal aiguillée */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sky-700">
            <ArrowRightLeft className="h-5 w-5" />
            <CardTitle className="text-base">
              1. Outil de Reclassement Traçable d’une Épreuve Mal Aiguillée
            </CardTitle>
          </div>
          <CardDescription>
            Sélectionnez une évaluation publiée pour la reclasser vers la bonne épreuve
            réglementaire (ex: <code>Cours niveau MF</code> coché par erreur au lieu de{' '}
            <code>Pédagogie AM ou MC</code>) avec mapping assisté des critères communs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b bg-slate-50 font-semibold uppercase text-slate-600">
                  <th className="px-3 py-2.5">Ligne / ID</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Candidat CMN</th>
                  <th className="px-3 py-2.5">Épreuve Actuelle</th>
                  <th className="px-3 py-2.5">Jury (Col. F)</th>
                  <th className="px-3 py-2.5">Commentaire (Col. DD)</th>
                  <th className="px-3 py-2.5 text-right">Action DTF</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {evaluations.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono font-semibold text-slate-600">
                      #{ev.legacy_row_id ?? ev.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{ev.event_date}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {getCandidateName(ev.candidate_id)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="secondary">
                        {getExamTitle(ev.exam_code)} ({ev.exam_code})
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {ev.legacy_evaluator_raw ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 max-w-xs truncate text-slate-600">
                      {ev.improvements_comment}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReclassifyModal(ev)}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        Reclasser l’épreuve
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modale dédiée au reclassement assisté avec motif obligatoire */}
      {selectedEvaluation && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        >
          <Card className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border-sky-200 bg-white shadow-2xl">
            <CardHeader className="border-b bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sky-700">
                  <FileWarning className="h-5 w-5" />
                  <CardTitle className="text-lg">
                    Reclassement Assisté de l’Évaluation #
                    {selectedEvaluation.legacy_row_id ?? selectedEvaluation.id}
                  </CardTitle>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedEvaluation(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Candidat :{' '}
                <strong>{getCandidateName(selectedEvaluation.candidate_id)}</strong> •
                Date : <strong>{selectedEvaluation.event_date}</strong> • Épreuve
                actuelle :{' '}
                <Badge variant="outline">{selectedEvaluation.exam_code}</Badge>
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleConfirmReclassification} className="space-y-5">
                {/* Sélection de la nouvelle épreuve cible */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">
                      Épreuve source (erronée)
                    </label>
                    <div className="mt-1 rounded-md border bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                      {getExamTitle(selectedEvaluation.exam_code)} (
                      {selectedEvaluation.exam_code})
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="target-exam-select"
                      className="text-xs font-semibold uppercase text-sky-700"
                    >
                      Nouvelle Épreuve Cible Réglementaire
                    </label>
                    <select
                      id="target-exam-select"
                      value={targetExamCode}
                      onChange={(e) =>
                        initializeTargetMapping(
                          selectedEvaluation,
                          e.target.value as ExamCode
                        )
                      }
                      className="mt-1 flex h-9 w-full rounded-md border border-sky-300 bg-white px-3 py-1 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {OFFICIAL_EXAM_TYPES.filter(
                        (ex) => ex.code !== selectedEvaluation.exam_code
                      ).map((ex) => (
                        <option key={ex.code} value={ex.code}>
                          {ex.short_title} — {ex.forms_label} ({ex.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mapping assisté des critères vers l'épreuve cible */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">
                      Mapping assisté des critères vers {getExamTitle(targetExamCode)}
                    </h3>
                    <span className="text-xs text-slate-500">
                      Les critères communs (même pilier et intitulé proche) sont
                      pré-remplis automatiquement
                    </span>
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b bg-slate-50 font-semibold text-slate-600">
                          <th className="px-3 py-2">Col. Excel</th>
                          <th className="px-3 py-2">Pilier</th>
                          <th className="px-3 py-2">Critère de l’épreuve cible</th>
                          <th className="px-3 py-2 text-right">Cotation attribuée</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {OFFICIAL_CRITERIA.filter(
                          (c) => c.exam_code === targetExamCode && c.is_active
                        ).map((crit) => (
                          <tr key={crit.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono font-bold text-slate-700">
                              {crit.excel_col}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="text-[10px]">
                                {crit.pillar_code}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-slate-800">
                              {crit.question_text}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <select
                                aria-label={`Cotation critère ${crit.excel_col}`}
                                value={mappedGrades[crit.id] ?? 'NE'}
                                onChange={(e) =>
                                  setMappedGrades((prev) => ({
                                    ...prev,
                                    [crit.id]: e.target.value as GradeCode,
                                  }))
                                }
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-900"
                              >
                                {GRADES_LIST.map((g) => (
                                  <option key={g} value={g}>
                                    {GRADE_LABELS[g]}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Motif obligatoire pour audit_logs */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="reclassify-reason"
                    className="text-sm font-semibold text-slate-800"
                  >
                    Motif obligatoire du reclassement (journalisé dans{' '}
                    <code>audit_logs</code>)
                  </label>
                  <Input
                    id="reclassify-reason"
                    placeholder="Ex: Erreur de sélection MS Forms par le jury lors de la séance pédagogique AM/MC du 18/03/2026"
                    value={reclassifyReason}
                    onChange={(e) => setReclassifyReason(e.target.value)}
                    required
                  />
                </div>

                {reclassifyError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {reclassifyError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedEvaluation(null)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit">
                    <ArrowRightLeft className="h-4 w-4" />
                    Confirmer le reclassement et journaliser
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. Annuaire Officiel des Moniteurs Nationaux, Administrateurs & Gestion des Rôles */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sky-700">
            <Users className="h-5 w-5" />
            <CardTitle className="text-base">
              2. Gestion des Profils, Administrateurs, Moniteurs Nationaux (MN) & Alias Excel
            </CardTitle>
          </div>
          <CardDescription>
            Modifiez directement ici le rôle d’un utilisateur (
            <strong>Administrateur</strong>,{' '}
            <strong>Moniteur National (MN) Évaluateur</strong>,{' '}
            <strong>Candidat Moniteur National (CMN)</strong>) et gérez les
            variantes orthographiques (<code>profiles.aliases</code>) pour l’import
            Excel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingProfile && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Modification du profil ${editingProfile.first_name} ${editingProfile.last_name}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setEditingProfile(null);
                }
              }}
              className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-slate-900/75 p-0 sm:p-6 backdrop-blur-sm"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateFullProfile(editingProfile, activeAdmin?.id ?? 'admin-dtf');
                  setCandidateCreatedMsg(
                    `Profil de ${editingProfile.first_name} ${editingProfile.last_name} (${USER_ROLE_LABELS[editingProfile.role]}) mis à jour.`
                  );
                  setEditingProfile(null);
                }}
                className="flex h-full w-full flex-col bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-sky-300 overflow-hidden"
              >
                <div className="flex shrink-0 items-center justify-between border-b bg-slate-900 px-4 py-3.5 text-white sm:px-6">
                  <div className="flex items-center gap-3 min-w-0">
                    {editingProfile.photo_storage_path ? (
                      <img
                        src={editingProfile.photo_storage_path}
                        alt={`${editingProfile.first_name} ${editingProfile.last_name}`}
                        className="h-9 w-9 shrink-0 rounded-full border-2 border-sky-400 object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-700 text-xs font-bold text-white">
                        {`${editingProfile.first_name.charAt(0)}${editingProfile.last_name.charAt(0)}`.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm sm:text-base font-bold text-white">
                        Modification du profil : {editingProfile.first_name}{' '}
                        {editingProfile.last_name}
                      </div>
                      <div className="text-[11px] text-sky-300">
                        {USER_ROLE_LABELS[editingProfile.role]}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Fermer la fenêtre de modification"
                    onClick={() => setEditingProfile(null)}
                    className="shrink-0 text-slate-200 hover:bg-slate-800 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Prénom
                      </label>
                      <Input
                        value={editingProfile.first_name}
                        onChange={(e) =>
                          setEditingProfile({
                            ...editingProfile,
                            first_name: e.target.value,
                          })
                        }
                        className="mt-1 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Nom
                      </label>
                      <Input
                        value={editingProfile.last_name}
                        onChange={(e) =>
                          setEditingProfile({
                            ...editingProfile,
                            last_name: e.target.value,
                          })
                        }
                        className="mt-1 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Rôle / Habilitation
                      </label>
                      <select
                        aria-label="Rôle du profil"
                        value={editingProfile.role}
                        onChange={(e) =>
                          setEditingProfile({
                            ...editingProfile,
                            role: e.target.value as UserRole,
                          })
                        }
                        className="mt-1 flex h-9 w-full rounded-md border border-sky-300 bg-white px-3 text-xs font-bold text-slate-900"
                      >
                        {(
                          [
                            'ADMIN_DTF',
                            'MN_EVALUATOR',
                            'CMN_CANDIDATE',
                          ] as UserRole[]
                        ).map((r) => (
                          <option key={r} value={r}>
                            {USER_ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        E-mail
                      </label>
                      <Input
                        type="email"
                        value={editingProfile.email}
                        onChange={(e) =>
                          setEditingProfile({
                            ...editingProfile,
                            email: e.target.value,
                          })
                        }
                        className="mt-1 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        N° FEBRAS (TEXT)
                      </label>
                      <Input
                        value={editingProfile.febras_number ?? ''}
                        onChange={(e) =>
                          setEditingProfile({
                            ...editingProfile,
                            febras_number: e.target.value,
                          })
                        }
                        className="mt-1 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Téléphone GSM (TEXT)
                      </label>
                      <Input
                        placeholder="Ex: 0475123456"
                        value={editingProfile.phone_gsm ?? ''}
                        onChange={(e) =>
                          setEditingProfile({
                            ...editingProfile,
                            phone_gsm: e.target.value,
                          })
                        }
                        className="mt-1 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Téléphone fixe (TEXT)
                      </label>
                      <Input
                        placeholder="Ex: 010223344"
                        value={editingProfile.phone_landline ?? ''}
                        onChange={(e) =>
                          setEditingProfile({
                            ...editingProfile,
                            phone_landline: e.target.value,
                          })
                        }
                        className="mt-1 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Club affilié
                      </label>
                      <Input
                        value={editingProfile.club_name ?? ''}
                        onChange={(e) =>
                          setEditingProfile({
                            ...editingProfile,
                            club_name: e.target.value,
                          })
                        }
                        className="mt-1 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">
                        Nombre de plongées
                      </label>
                      <Input
                        type="number"
                        value={editingProfile.dives_count ?? 0}
                        onChange={(e) =>
                          setEditingProfile({
                            ...editingProfile,
                            dives_count: Number.parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="mt-1 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <label className="text-xs font-semibold text-slate-700">
                        Photo du profil (Tous les profils : CMN, MN, Administrateur)
                      </label>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {editingProfile.photo_storage_path ? (
                          <img
                            src={editingProfile.photo_storage_path}
                            alt={`${editingProfile.first_name} ${editingProfile.last_name}`}
                            className="h-14 w-14 rounded-full border-2 border-sky-500 object-cover shadow-sm"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                            <Camera className="h-5 w-5 text-slate-500" />
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          aria-label="Modifier la photo du profil"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handlePhotoFileToDataUrl(file, (dataUrl) => {
                                setEditingProfile((prev) =>
                                  prev
                                    ? { ...prev, photo_storage_path: dataUrl }
                                    : null
                                );
                              });
                            }
                          }}
                          className="text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-sky-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-slate-50 px-4 py-3 sm:px-6">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Confirmer la suppression définitive du profil de ${editingProfile.first_name} ${editingProfile.last_name} ?`
                        )
                      ) {
                        deleteProfile(
                          editingProfile.id,
                          activeAdmin?.id ?? 'admin-dtf'
                        );
                        setCandidateCreatedMsg(
                          `Le profil de ${editingProfile.first_name} ${editingProfile.last_name} a été supprimé.`
                        );
                        setEditingProfile(null);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer ce profil
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingProfile(null)}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Enregistrer les modifications
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {[...mnDirectory, ...candidates].map((mn) => (
              <div
                key={mn.id}
                className="flex flex-col justify-between rounded-lg border bg-slate-50/70 p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {mn.photo_storage_path ? (
                        <img
                          src={mn.photo_storage_path}
                          alt={`${mn.first_name} ${mn.last_name}`}
                          className="h-10 w-10 rounded-full border border-sky-400 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                          {`${mn.first_name.charAt(0)}${mn.last_name.charAt(0)}`.toUpperCase()}
                        </div>
                      )}
                      <span className="font-semibold text-slate-900">
                        {mn.first_name} {mn.last_name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        aria-label={`Rôle de ${mn.first_name} ${mn.last_name}`}
                        value={mn.role}
                        onChange={(e) =>
                          updateProfileRole(
                            mn.id,
                            e.target.value as UserRole,
                            activeAdmin?.id ?? 'admin-dtf'
                          )
                        }
                        className="rounded border border-sky-300 bg-white px-2 py-1 text-xs font-bold text-sky-900"
                      >
                        {(
                          [
                            'ADMIN_DTF',
                            'MN_EVALUATOR',
                            'CMN_CANDIDATE',
                          ] as UserRole[]
                        ).map((r) => (
                          <option key={r} value={r}>
                            {USER_ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingProfile(mn)}
                        className="h-7 px-2 text-xs"
                      >
                        Modifier le profil
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        title={`Supprimer le profil de ${mn.first_name} ${mn.last_name}`}
                        aria-label={`Supprimer ${mn.first_name} ${mn.last_name}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Confirmer la suppression définitive du profil de ${mn.first_name} ${mn.last_name} ?`
                            )
                          ) {
                            deleteProfile(mn.id, activeAdmin?.id ?? 'admin-dtf');
                            setCandidateCreatedMsg(
                              `Le profil de ${mn.first_name} ${mn.last_name} a été supprimé.`
                            );
                          }
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Supprimer
                      </Button>
                      <Badge variant="outline" className="font-mono text-[11px]">
                        FEBRAS #{mn.febras_number}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {mn.email} • GSM : {mn.phone_gsm ?? '—'} • Fixe :{' '}
                    {mn.phone_landline ?? '—'} • {mn.club_name ?? '—'}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {mn.aliases.map((al) => (
                      <Badge key={al} variant="secondary" className="text-xs">
                        {al}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="Ajouter un alias (ex: Lambert J.M.)"
                    value={aliasInputs[mn.id] ?? ''}
                    onChange={(e) =>
                      setAliasInputs((prev) => ({
                        ...prev,
                        [mn.id]: e.target.value,
                      }))
                    }
                    className="h-8 bg-white text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const val = aliasInputs[mn.id] ?? '';
                      if (val.trim()) {
                        addAliasToMn(mn.id, val);
                        setAliasInputs((prev) => ({ ...prev, [mn.id]: '' }));
                      }
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Corbeille / Profils Archivés (exclusivement réservée au concepteur Patrice Finet) */}
      {isCreator && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-800">
                <RotateCcw className="h-5 w-5" />
                <CardTitle className="text-base">
                  Corbeille des Profils Archivés (Accès Exclusif Concepteur)
                </CardTitle>
                <Badge variant="secondary" className="text-[11px]">
                  {archivedProfiles.length} profil
                  {archivedProfiles.length > 1 ? 's' : ''}
                </Badge>
              </div>
              <Badge className="bg-amber-700 text-white text-[10px]">
                Réservé à Patrice Finet
              </Badge>
            </div>
            <CardDescription>
              Chaque profil supprimé par un administrateur est conservé ici avec sa
              photo et ses coordonnées. Vous seul pouvez le restaurer en un clic ou
              le purger définitivement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {archivedProfiles.length === 0 ? (
              <p className="text-xs text-slate-500">
                La corbeille est actuellement vide. Aucun profil supprimé en attente
                de restauration.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {archivedProfiles.map((arch) => (
                  <div
                    key={arch.id}
                    className="flex min-w-0 max-w-full flex-col gap-3 overflow-hidden rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      {arch.photo_storage_path ? (
                        <img
                          src={arch.photo_storage_path}
                          alt={`${arch.first_name} ${arch.last_name}`}
                          className="h-10 w-10 shrink-0 rounded-full border border-amber-400 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-900">
                          {`${arch.first_name.charAt(0)}${arch.last_name.charAt(0)}`.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {arch.first_name} {arch.last_name}
                        </div>
                        <div className="text-[11px] font-medium text-slate-600">
                          {USER_ROLE_LABELS[arch.role]}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">
                          {arch.email}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Archivé le{' '}
                          {new Date(arch.updated_at).toLocaleString('fr-BE')}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700"
                        onClick={() => {
                          restoreProfile(
                            arch.id,
                            activeAdmin?.email ?? '',
                            activeAdmin?.id ?? ''
                          );
                          setCandidateCreatedMsg(
                            `Le profil de ${arch.first_name} ${arch.last_name} a été restauré avec toutes ses données.`
                          );
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restaurer
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        title="Purger définitivement de la corbeille"
                        className="h-7 border-red-200 px-2 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Purger définitivement ${arch.first_name} ${arch.last_name} de la corbeille ? Cette action est irréversible.`
                            )
                          ) {
                            purgeArchivedProfile(
                              arch.id,
                              activeAdmin?.email ?? '',
                              activeAdmin?.id ?? ''
                            );
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. Journal d'Audit Immuable (audit_logs) */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sky-700">
              <History className="h-5 w-5" />
              <CardTitle className="text-base">
                3. Journal d’Audit Immuable (Table <code>audit_logs</code>)
              </CardTitle>
              <Badge variant="secondary" className="text-[11px]">
                {auditLogs.length} entrée{auditLogs.length > 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={auditViewSize === 'collapsed' ? 'default' : 'outline'}
                onClick={() =>
                  setAuditViewSize((prev) =>
                    prev === 'collapsed' ? 'compact' : 'collapsed'
                  )
                }
                className="h-7 px-2 text-xs"
              >
                {auditViewSize === 'collapsed' ? (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Déplier
                  </>
                ) : (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Réduire
                  </>
                )}
              </Button>
              {auditViewSize !== 'collapsed' && (
                <Button
                  type="button"
                  size="sm"
                  variant={auditViewSize === 'expanded' ? 'default' : 'outline'}
                  onClick={() =>
                    setAuditViewSize((prev) =>
                      prev === 'expanded' ? 'compact' : 'expanded'
                    )
                  }
                  className="h-7 px-2 text-xs"
                >
                  {auditViewSize === 'expanded' ? (
                    <>
                      <Minimize2 className="h-3.5 w-3.5" />
                      Compact
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3.5 w-3.5" />
                      Agrandir
                    </>
                  )}
                </Button>
              )}
              {isCreator && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={auditLogs.length === 0}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Confirmer la remise à zéro définitive du Journal d'Audit (action réservée exclusivement au concepteur Patrice Finet) ?"
                      )
                    ) {
                      clearAuditLogs(
                        activeAdmin?.email ?? '',
                        activeAdmin?.id ?? ''
                      );
                    }
                  }}
                  title="Remettre à zéro le Journal d'Audit (réservé au concepteur)"
                  className="h-7 px-2.5 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remettre à zéro
                </Button>
              )}
            </div>
          </div>
          <CardDescription>
            Historique complet et non modifiable des reclassements d’épreuves et des
            imports administratifs avec valeurs JSONB avant/après.
          </CardDescription>
        </CardHeader>
        {auditViewSize !== 'collapsed' && (
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">
                Aucune opération consignée dans cette session. Effectuez un reclassement
                d’épreuve ci-dessus ou validez un import Excel pour inspecter l’écriture
                dans <code>audit_logs</code>.
              </p>
            ) : (
              <div
                className={`space-y-3 ${
                  auditViewSize === 'compact'
                    ? 'max-h-72 overflow-y-auto pr-1'
                    : ''
                }`}
              >
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-slate-900 text-white">{log.action}</Badge>
                        <span className="font-mono text-slate-600">
                          {log.entity_type} / {log.entity_id}
                        </span>
                      </div>
                      <span className="text-slate-400">
                        {new Date(log.created_at).toLocaleString('fr-BE')}
                      </span>
                    </div>
                    <p className="mt-1.5 font-medium text-slate-800">
                      Motif : « {log.reason} »
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded border bg-white p-2 font-mono text-[11px] text-slate-600">
                        <div className="font-sans font-semibold text-slate-500">
                          previous_value (JSONB) :
                        </div>
                        {JSON.stringify(log.previous_value)}
                      </div>
                      <div className="rounded border bg-white p-2 font-mono text-[11px] text-slate-700">
                        <div className="font-sans font-semibold text-sky-700">
                          new_value (JSONB) :
                        </div>
                        {JSON.stringify(log.new_value)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
