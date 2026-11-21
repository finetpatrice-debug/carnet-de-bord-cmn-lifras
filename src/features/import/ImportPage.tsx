import React, { useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { useAdminStore } from '@/features/admin/AdminStoreContext';
import {
  buildSampleGoldenWorkbookBuffer,
  computePreviewFromParsedRows,
  parseCmnExcelWorkbook,
  type ExcelWorkbookImportPreview,
} from './excelImporter';
import { OFFICIAL_EXAM_TYPES, OFFICIAL_PILLARS } from '@/domain/referentials';
import type {
  AuditLog,
  Evaluation,
  EvaluationScore,
  ExamCode,
  Profile,
} from '@/domain/types';
import { Button } from '@/components/ui/button';
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
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Sparkles,
  UploadCloud,
  UserCheck,
  Users,
} from 'lucide-react';

export function ImportPage(): React.ReactElement {
  const { profile: activeAdmin } = useAuth();
  const { mnDirectory, candidates, addAliasToMn, importCandidateWorkbookData } =
    useAdminStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<ExcelWorkbookImportPreview | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const handleArrayBuffer = (buffer: ArrayBuffer, fileName: string): void => {
    setImportSuccessMsg(null);
    const parsed = parseCmnExcelWorkbook(buffer, fileName, mnDirectory);
    setPreview(parsed);

    // Enregistrement et inscription automatique du candidat et de ses évaluations dès le chargement du fichier Excel
    const nowIso = new Date().toISOString();
    const existingCandidate = candidates.find(
      (c) =>
        c.email.toLowerCase() === parsed.candidate.email.toLowerCase() ||
        (c.last_name.toLowerCase() === parsed.candidate.last_name.toLowerCase() &&
          c.first_name.toLowerCase() === parsed.candidate.first_name.toLowerCase())
    );
    const candidateId =
      existingCandidate?.id ??
      `cand-${parsed.candidate.last_name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')}-${parsed.candidate.first_name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')}`;

    const candidateProfile: Profile = {
      id: candidateId,
      role: existingCandidate?.role ?? 'CMN_CANDIDATE',
      cohort_id: existingCandidate?.cohort_id ?? 'cohort-2026',
      sponsor_mn_id: existingCandidate?.sponsor_mn_id ?? null,
      last_name: parsed.candidate.last_name,
      first_name: parsed.candidate.first_name,
      birth_date: parsed.candidate.birth_date ?? existingCandidate?.birth_date ?? null,
      street_address:
        parsed.candidate.street_address ?? existingCandidate?.street_address ?? null,
      postal_code:
        parsed.candidate.postal_code ?? existingCandidate?.postal_code ?? null,
      city: parsed.candidate.city ?? existingCandidate?.city ?? null,
      phone_landline:
        parsed.candidate.phone_landline ?? existingCandidate?.phone_landline ?? null,
      phone_gsm: parsed.candidate.phone_gsm ?? existingCandidate?.phone_gsm ?? null,
      email: parsed.candidate.email,
      febras_number:
        parsed.candidate.febras_number ?? existingCandidate?.febras_number ?? null,
      cfps_year: parsed.candidate.cfps_year ?? existingCandidate?.cfps_year ?? null,
      mf_year: parsed.candidate.mf_year ?? existingCandidate?.mf_year ?? null,
      dives_count:
        parsed.candidate.dives_count ?? existingCandidate?.dives_count ?? null,
      club_name: parsed.candidate.club_name ?? existingCandidate?.club_name ?? null,
      club_president:
        parsed.candidate.club_president ?? existingCandidate?.club_president ?? null,
      club_head_instructor:
        parsed.candidate.club_head_instructor ??
        existingCandidate?.club_head_instructor ??
        null,
      club_head_gsm: existingCandidate?.club_head_gsm ?? null,
      photo_storage_path: existingCandidate?.photo_storage_path ?? null,
      aliases: existingCandidate?.aliases ?? [
        `${parsed.candidate.last_name} ${parsed.candidate.first_name}`,
      ],
      created_at: existingCandidate?.created_at ?? nowIso,
      updated_at: nowIso,
    };

    const newEvaluations: Evaluation[] = [];
    const newScores: EvaluationScore[] = [];

    for (const row of parsed.evaluations) {
      if (!row.exam_code) continue;
      const evalId = `eval-imp-${candidateId}-${row.legacy_row_id}`;
      const leadMatch = row.jury_matches.find((m) => m.matchedProfileId !== null);

      newEvaluations.push({
        id: evalId,
        legacy_row_id: row.legacy_row_id,
        candidate_id: candidateId,
        exam_code: row.exam_code,
        lead_evaluator_id: leadMatch?.matchedProfileId ?? null,
        legacy_evaluator_raw: row.legacy_evaluator_raw,
        event_date: row.event_date,
        started_at: row.started_at,
        submitted_at: row.submitted_at,
        improvements_comment: row.improvements_comment,
        strengths_comment: row.strengths_comment,
        status: 'PUBLISHED',
        created_at: nowIso,
        updated_at: nowIso,
      });

      for (const sc of row.scores) {
        newScores.push({
          evaluation_id: evalId,
          criterion_id: sc.criterion_id,
          grade: sc.grade,
        });
      }
    }

    const auditLog: AuditLog = {
      id: `audit-imp-${Date.now()}`,
      actor_id: activeAdmin?.id ?? null,
      entity_type: 'profiles',
      entity_id: candidateId,
      action: 'EXCEL_WORKBOOK_IMPORT',
      previous_value: null,
      new_value: {
        fileName: parsed.fileName,
        candidate: `${candidateProfile.first_name} ${candidateProfile.last_name}`,
        evaluationsImported: newEvaluations.length,
        scoresImported: newScores.length,
        globalPillarScores: parsed.scoreboardPreview.formattedGlobalPillarScores,
      },
      reason: `Import automatique certifié Iso-Excel du classeur ${parsed.fileName}`,
      created_at: nowIso,
    };

    importCandidateWorkbookData({
      candidateProfile,
      newEvaluations,
      newScores,
      auditLog,
    });

    setImportSuccessMsg(
      `Inscription et import automatiques effectués : Fiche de ${candidateProfile.first_name} ${candidateProfile.last_name}, ${newEvaluations.length} évaluations et ${newScores.length} cotations enregistrées dans l'application.`
    );
  };

  const handleFileSelected = async (file: File): Promise<void> => {
    const buffer = await file.arrayBuffer();
    handleArrayBuffer(buffer, file.name);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>): Promise<void> => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleFileSelected(file);
    }
  };

  const handleLoadSampleGoldenWorkbook = (): void => {
    const buffer = buildSampleGoldenWorkbookBuffer();
    handleArrayBuffer(buffer, 'Carnet_CMN_Thomas_Peeters_20_Evals.xlsx');
  };

  const handleDownloadSampleWorkbook = (): void => {
    const buffer = buildSampleGoldenWorkbookBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Modele_Carnet_CMN_Golden_20_Evals.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Permet au DTF de modifier manuellement l'appariement d'un membre de jury sur une ligne
  const handleManualJuryOverride = (
    rowTempId: string,
    tokenIndex: number,
    selectedMnId: string,
    saveAsAlias: boolean
  ): void => {
    if (!preview) return;
    const mn = mnDirectory.find((m) => m.id === selectedMnId) ?? null;

    const updatedEvaluations = preview.evaluations.map((row) => {
      if (row.tempId !== rowTempId) return row;
      const updatedMatches = row.jury_matches.map((jm, idx) => {
        if (idx !== tokenIndex) return jm;
        if (saveAsAlias && mn && jm.rawToken) {
          addAliasToMn(mn.id, jm.rawToken);
        }
        return {
          ...jm,
          matchedProfileId: mn ? mn.id : null,
          matchedFullName: mn ? `${mn.first_name} ${mn.last_name}` : null,
          confidence: mn ? 1 : 0,
          matchMethod: mn ? ('ALIAS' as const) : ('UNMATCHED' as const),
        };
      });
      return { ...row, jury_matches: updatedMatches };
    });

    setPreview({
      ...preview,
      evaluations: updatedEvaluations,
    });
  };

  // Permet au DTF de corriger à la volée le type d'épreuve d'une ligne avant import
  const handleRowExamChange = (rowTempId: string, newExamCode: ExamCode): void => {
    if (!preview) return;
    const updatedEvaluations = preview.evaluations.map((row) =>
      row.tempId === rowTempId
        ? { ...row, exam_code: newExamCode, exam_recognition_warning: null }
        : row
    );
    const updatedScoreboard = computePreviewFromParsedRows(updatedEvaluations);
    setPreview({
      ...preview,
      evaluations: updatedEvaluations,
      scoreboardPreview: updatedScoreboard,
    });
  };

  const handleConfirmDatabaseImport = (): void => {
    if (!preview) return;
    const nowIso = new Date().toISOString();
    const existingCandidate = candidates.find(
      (c) =>
        c.email.toLowerCase() === preview.candidate.email.toLowerCase() ||
        (c.last_name.toLowerCase() === preview.candidate.last_name.toLowerCase() &&
          c.first_name.toLowerCase() === preview.candidate.first_name.toLowerCase())
    );
    const candidateId =
      existingCandidate?.id ??
      `cand-${preview.candidate.last_name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

    const candidateProfile: Profile = {
      id: candidateId,
      role: existingCandidate?.role ?? 'CMN_CANDIDATE',
      cohort_id: existingCandidate?.cohort_id ?? 'cohort-2026',
      sponsor_mn_id: existingCandidate?.sponsor_mn_id ?? null,
      last_name: preview.candidate.last_name,
      first_name: preview.candidate.first_name,
      birth_date: preview.candidate.birth_date ?? existingCandidate?.birth_date ?? null,
      street_address:
        preview.candidate.street_address ?? existingCandidate?.street_address ?? null,
      postal_code:
        preview.candidate.postal_code ?? existingCandidate?.postal_code ?? null,
      city: preview.candidate.city ?? existingCandidate?.city ?? null,
      phone_landline:
        preview.candidate.phone_landline ?? existingCandidate?.phone_landline ?? null,
      phone_gsm: preview.candidate.phone_gsm ?? existingCandidate?.phone_gsm ?? null,
      email: preview.candidate.email,
      febras_number:
        preview.candidate.febras_number ?? existingCandidate?.febras_number ?? null,
      cfps_year: preview.candidate.cfps_year ?? existingCandidate?.cfps_year ?? null,
      mf_year: preview.candidate.mf_year ?? existingCandidate?.mf_year ?? null,
      dives_count:
        preview.candidate.dives_count ?? existingCandidate?.dives_count ?? null,
      club_name: preview.candidate.club_name ?? existingCandidate?.club_name ?? null,
      club_president:
        preview.candidate.club_president ?? existingCandidate?.club_president ?? null,
      club_head_instructor:
        preview.candidate.club_head_instructor ??
        existingCandidate?.club_head_instructor ??
        null,
      club_head_gsm: existingCandidate?.club_head_gsm ?? null,
      photo_storage_path: existingCandidate?.photo_storage_path ?? null,
      aliases: existingCandidate?.aliases ?? [
        `${preview.candidate.last_name} ${preview.candidate.first_name}`,
      ],
      created_at: existingCandidate?.created_at ?? nowIso,
      updated_at: nowIso,
    };

    const newEvaluations: Evaluation[] = [];
    const newScores: EvaluationScore[] = [];

    for (const row of preview.evaluations) {
      if (!row.exam_code) continue;
      const evalId = `eval-imp-${row.legacy_row_id}-${Date.now().toString().slice(-4)}`;
      const leadMatch = row.jury_matches.find((m) => m.matchedProfileId !== null);

      newEvaluations.push({
        id: evalId,
        legacy_row_id: row.legacy_row_id,
        candidate_id: candidateId,
        exam_code: row.exam_code,
        lead_evaluator_id: leadMatch?.matchedProfileId ?? null,
        legacy_evaluator_raw: row.legacy_evaluator_raw,
        event_date: row.event_date,
        started_at: row.started_at,
        submitted_at: row.submitted_at,
        improvements_comment: row.improvements_comment,
        strengths_comment: row.strengths_comment,
        status: 'PUBLISHED',
        created_at: nowIso,
        updated_at: nowIso,
      });

      for (const sc of row.scores) {
        newScores.push({
          evaluation_id: evalId,
          criterion_id: sc.criterion_id,
          grade: sc.grade,
        });
      }
    }

    const auditLog: AuditLog = {
      id: `audit-imp-${Date.now()}`,
      actor_id: activeAdmin?.id ?? null,
      entity_type: 'profiles',
      entity_id: candidateId,
      action: 'EXCEL_WORKBOOK_IMPORT',
      previous_value: null,
      new_value: {
        fileName: preview.fileName,
        candidate: `${candidateProfile.first_name} ${candidateProfile.last_name}`,
        evaluationsImported: newEvaluations.length,
        scoresImported: newScores.length,
        globalPillarScores: preview.scoreboardPreview.formattedGlobalPillarScores,
      },
      reason: `Import initial certifié Iso-Excel du classeur ${preview.fileName}`,
      created_at: nowIso,
    };

    importCandidateWorkbookData({
      candidateProfile,
      newEvaluations,
      newScores,
      auditLog,
    });

    setImportSuccessMsg(
      `Import validé avec succès : Fiche de ${candidateProfile.first_name} ${candidateProfile.last_name}, ${newEvaluations.length} évaluations et ${newScores.length} cotations unitaires enregistrées et tracées dans audit_logs.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Zone de dépôt .xlsx et chargement du classeur témoin */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sky-700">
              <FileSpreadsheet className="h-5 w-5" />
              <CardTitle>
                Importateur Intelligent de Classeurs Excel CMN (SheetJS / Iso-Excel)
              </CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadSampleWorkbook}
              >
                <Download className="h-4 w-4" />
                Télécharger un .xlsx témoin
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleLoadSampleGoldenWorkbook}
              >
                <Sparkles className="h-4 w-4" />
                Charger le dossier témoin (20 évals)
              </Button>
            </div>
          </div>
          <CardDescription>
            Glissez-déposez un classeur individuel <code>.xlsx</code>. Extraction
            automatique de la feuille <strong>Informations personnelles</strong> (cellules
            exactes <code>D11..D36</code>, rétablissement du <code>0</code> initial GSM
            belge, contrôle de cohérence CFPS) et de la feuille <strong>Données</strong>{' '}
            (colonnes <code>I</code> à <code>DE</code> + dédoublonnage des jurys MN).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Information claire sur le fonctionnement de l'import Excel pour un candidat en cours de cursus */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3.5 text-xs text-sky-950 space-y-1">
            <div className="font-bold text-sky-900">
              Comment se déroule un import Excel pour un candidat en cours de cursus ?
            </div>
            <p>
              1. <strong>Transcription complète</strong> : toutes les évaluations, notes par critère et commentaires du classeur Excel sont intégrés dans le <strong>Tableau de Bord</strong> (5 piliers, Radar, bilans PDF) <strong>et</strong> répercutés automatiquement en rappel sur chaque épreuve et chaque question de l’onglet <strong>Évaluation Terrain</strong>.
            </p>
            <p>
              2. <strong>Continuité des évaluations terrain</strong> : après l’import, les Moniteurs Nationaux continuent à évaluer normalement le candidat dans l’application. Chaque nouvelle évaluation terrain s’ajoute à la suite de son historique sans jamais écraser ni dupliquer les notes importées.
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
              isDragging
                ? 'border-sky-500 bg-sky-50'
                : 'border-slate-300 bg-slate-50/70 hover:border-sky-400 hover:bg-slate-100/60'
            }`}
          >
            <UploadCloud className="h-10 w-10 text-sky-600" />
            <p className="mt-2 text-sm font-semibold text-slate-800">
              Glissez-déposez un fichier Excel (.xlsx) ici ou cliquez pour parcourir
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Feuilles attendues : « Informations personnelles » et « Données » (Colonnes A
              à DE)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleFileSelected(file);
                }
              }}
            />
          </div>

          {importSuccessMsg && (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <span>{importSuccessMsg}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {preview && (
        <>
          {/* Alertes visuelles d'intégrité (Année CFPS future, GSM normalisé, etc.) */}
          {preview.warnings.length > 0 && (
            <Card className="border-amber-300 bg-amber-50/70">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-base">
                    Contrôles d’intégrité & Normalisations automatiques ({preview.warnings.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-xs text-amber-900">
                  {preview.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* 1. Fiche signalétique extraite de Informations personnelles */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  1. Fiche Candidat extraite (« Informations personnelles »)
                </CardTitle>
                <Badge variant="outline">{preview.fileName}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Nom (D11) & Prénom (G11)</div>
                  <div className="font-semibold text-slate-900">
                    {preview.candidate.last_name} {preview.candidate.first_name}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Naissance (D13) : {preview.candidate.birth_date ?? 'N/A'}
                  </div>
                </div>

                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">
                    Adresse (D16, D18, G18) & Email (D23)
                  </div>
                  <div className="font-medium text-slate-900">
                    {preview.candidate.street_address ?? '—'},{' '}
                    {preview.candidate.postal_code ?? ''}{' '}
                    {preview.candidate.city ?? ''}
                  </div>
                  <div className="mt-1 text-xs text-sky-700">
                    {preview.candidate.email}
                  </div>
                </div>

                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">
                    Téléphone (D21), GSM (G21) & N° FEBRAS (D27)
                  </div>
                  <div className="flex items-center gap-2 font-mono font-semibold text-slate-900">
                    <span>GSM : {preview.candidate.phone_gsm ?? '—'}</span>
                    {preview.candidate.gsm_zero_restored && (
                      <Badge className="bg-emerald-600 text-[10px] text-white">
                        0 initial rétabli
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-600">
                    Fixe : {preview.candidate.phone_landline ?? '—'} • FEBRAS :{' '}
                    {preview.candidate.febras_number ?? '—'}
                  </div>
                </div>

                <div
                  className={`rounded-lg border p-3 ${
                    preview.candidate.cfps_year_warning
                      ? 'border-red-300 bg-red-50'
                      : 'bg-slate-50'
                  }`}
                >
                  <div className="text-xs text-slate-500">
                    Cursus (CFPS D28, MF G28, Plongées D30, Club D34)
                  </div>
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <span>CFPS : {preview.candidate.cfps_year ?? '—'}</span>
                    {preview.candidate.cfps_year_warning && (
                      <Badge variant="destructive" className="text-[10px]">
                        Année incohérente
                      </Badge>
                    )}
                    <span>• MF : {preview.candidate.mf_year ?? '—'}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {preview.candidate.dives_count ?? 0} plongées •{' '}
                    {preview.candidate.club_name ?? '—'} (Prés.{' '}
                    {preview.candidate.club_president ?? '—'}, Chef éc.{' '}
                    {preview.candidate.club_head_instructor ?? '—'})
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Aperçu de contrôle des 5 moyennes Iso-Excel calculées */}
          <Card className="border-sky-200 bg-sky-50/40">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base text-slate-900">
                    2. Aperçu de Contrôle des 5 Moyennes Globales (Moteur Iso-Excel)
                  </CardTitle>
                  <CardDescription>
                    Vérification mathématique en temps réel sur les{' '}
                    <strong>{preview.scoreboardPreview.totalPublishedEvaluations}</strong>{' '}
                    évaluations extraites avant enregistrement en base.
                  </CardDescription>
                </div>
                <Button onClick={handleConfirmDatabaseImport} className="bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Valider et Importer dans la Base
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-5">
                {OFFICIAL_PILLARS.map((pillar) => (
                  <div
                    key={pillar.code}
                    className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm"
                  >
                    <div className="text-xs font-medium text-slate-500">
                      {pillar.title}
                    </div>
                    <div className="mt-1 text-2xl font-bold text-sky-700">
                      {preview.scoreboardPreview.formattedGlobalPillarScores[pillar.code]}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      Code : {pillar.code}
                    </div>
                  </div>
                ))}
              </div>

              {/* Synthèse par épreuve */}
              <div className="overflow-x-auto rounded-lg border bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 font-semibold uppercase text-slate-600">
                      <th className="px-3 py-2">Épreuve</th>
                      <th className="px-3 py-2 text-center">Nb Évals</th>
                      <th className="px-3 py-2 text-right">Leadership</th>
                      <th className="px-3 py-2 text-right">Formateur</th>
                      <th className="px-3 py-2 text-right">Conception</th>
                      <th className="px-3 py-2 text-right">Connaissances</th>
                      <th className="px-3 py-2 text-right">Organisateur</th>
                      <th className="px-3 py-2 text-right">Moyenne Épreuve</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {OFFICIAL_EXAM_TYPES.map((exam) => {
                      const summary = preview.scoreboardPreview.exams[exam.code];
                      return (
                        <tr key={exam.code} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {exam.short_title}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold">
                            {summary.evaluationCount}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {summary.pillars.LEADERSHIP?.formattedScore ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {summary.pillars.FORMATEUR?.formattedScore ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {summary.pillars.CONCEPTION?.formattedScore ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {summary.pillars.CONNAISSANCES?.formattedScore ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {summary.pillars.ORGANISATEUR?.formattedScore ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-sky-700">
                            {summary.formattedExamAverage}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 3. Assistant de normalisation des jurys MN & Détail des lignes Données */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sky-700">
                <Users className="h-5 w-5" />
                <CardTitle className="text-base">
                  3. Assistant de Normalisation & Dédoublonnage des Jurys MN (Colonne F) et Lignes « Données »
                </CardTitle>
              </div>
              <CardDescription>
                Découpage automatique des jurys multiples (<code>,</code>, <code>&amp;</code>,{' '}
                <code>et</code>) et appariement flou (insensible à la casse et à l’inversion
                Nom/Prénom) vers l’annuaire officiel <code>MN_EVALUATOR</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 font-semibold uppercase text-slate-600">
                      <th className="px-3 py-2">Ligne</th>
                      <th className="px-3 py-2">Date (Col. G)</th>
                      <th className="px-3 py-2">Épreuve (Col. H)</th>
                      <th className="px-3 py-2">Jury brut (Col. F) & Appariement MN</th>
                      <th className="px-3 py-2 text-center">Items cotés</th>
                      <th className="px-3 py-2">Commentaires (Col. DD & DE)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.evaluations.map((row) => (
                      <tr key={row.tempId} className="align-top hover:bg-slate-50/70">
                        <td className="px-3 py-2.5 font-mono font-semibold text-slate-600">
                          #{row.legacy_row_id}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                          {row.event_date}
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            aria-label={`Épreuve ligne ${row.legacy_row_id}`}
                            value={row.exam_code ?? ''}
                            onChange={(e) =>
                              handleRowExamChange(row.tempId, e.target.value as ExamCode)
                            }
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800"
                          >
                            <option value="" disabled>
                              -- Non reconnu ({row.raw_forms_label}) --
                            </option>
                            {OFFICIAL_EXAM_TYPES.map((ex) => (
                              <option key={ex.code} value={ex.code}>
                                {ex.short_title} ({ex.code})
                              </option>
                            ))}
                          </select>
                          <div className="mt-1 text-[11px] text-slate-400">
                            Col. H : « {row.raw_forms_label} »
                          </div>
                        </td>
                        <td className="px-3 py-2.5 space-y-2">
                          <div className="text-[11px] text-slate-500">
                            Brut : <span className="font-medium text-slate-700">{row.legacy_evaluator_raw}</span>
                          </div>
                          <div className="space-y-1.5">
                            {row.jury_matches.map((jm, tIdx) => (
                              <div
                                key={tIdx}
                                className="flex flex-wrap items-center gap-1.5 rounded border border-slate-200 bg-slate-50 p-1.5"
                              >
                                <Badge variant="outline" className="text-[10px]">
                                  « {jm.rawToken} »
                                </Badge>
                                <span className="text-slate-400">→</span>
                                <select
                                  aria-label={`Associer le jury ${jm.rawToken}`}
                                  value={jm.matchedProfileId ?? ''}
                                  onChange={(e) =>
                                    handleManualJuryOverride(
                                      row.tempId,
                                      tIdx,
                                      e.target.value,
                                      true
                                    )
                                  }
                                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-800"
                                >
                                  <option value="">-- Non résolu --</option>
                                  {mnDirectory.map((mn) => (
                                    <option key={mn.id} value={mn.id}>
                                      {mn.first_name} {mn.last_name} (#{mn.febras_number})
                                    </option>
                                  ))}
                                </select>
                                <Badge
                                  variant={
                                    jm.matchMethod === 'UNMATCHED'
                                      ? 'destructive'
                                      : 'secondary'
                                  }
                                  className="text-[10px]"
                                >
                                  <UserCheck className="mr-1 h-3 w-3" />
                                  {jm.matchMethod} ({Math.round(jm.confidence * 100)}%)
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant="secondary">{row.scores.length} notes</Badge>
                        </td>
                        <td className="px-3 py-2.5 max-w-xs space-y-1">
                          <div>
                            <span className="font-semibold text-amber-700">DD (Améliorer) :</span>{' '}
                            <span className="text-slate-600">
                              {row.improvements_comment || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="font-semibold text-emerald-700">DE (Garder) :</span>{' '}
                            <span className="text-slate-600">
                              {row.strengths_comment || '—'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
