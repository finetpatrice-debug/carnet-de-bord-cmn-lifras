import type { CandidateScoreboardResult } from '@/domain/scoringEngine';
import { OFFICIAL_EXAM_TYPES, OFFICIAL_PILLARS } from '@/domain/referentials';
import type { Evaluation, Profile } from '@/domain/types';
import type { EvaluatorCrossMatrix } from './dashboardAnalytics';

function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface OfficialDeliberationReportPayload {
  candidate: Profile;
  scoreboard: CandidateScoreboardResult;
  evaluations: Evaluation[];
  evaluatorMatrix: EvaluatorCrossMatrix;
}

/**
 * Construit le document HTML A4 paginé, horodaté et prêt pour l'impression / export PDF
 * pour l'archivage et la délibération du Collège National des Moniteurs Nationaux (LIFRAS).
 */
export function buildOfficialPdfReportHtml(
  payload: OfficialDeliberationReportPayload
): string {
  const { candidate, scoreboard, evaluations, evaluatorMatrix } = payload;
  const generatedAt = new Date().toLocaleString('fr-BE', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const publishedEvals = evaluations
    .filter((ev) => ev.status === 'PUBLISHED')
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  const nonEmptyComments = publishedEvals.filter(
    (ev) =>
      ev.strengths_comment.trim().length > 0 ||
      ev.improvements_comment.trim().length > 0
  );

  const pillarsRowsHtml = OFFICIAL_PILLARS.map((pillar) => {
    const scoreNum = scoreboard.globalPillarScores[pillar.code];
    const formatted = scoreboard.formattedGlobalPillarScores[pillar.code];
    const appreciation =
      scoreNum >= 0.8
        ? 'Maîtrise (>= 80 %)'
        : scoreNum >= 0.6
          ? 'Acquis à consolider (60-79 %)'
          : scoreNum > 0
            ? 'Vigilance (< 60 %)'
            : 'Non évalué';

    return `
      <tr>
        <td><strong>#${pillar.display_order} — ${escapeHtml(pillar.title)}</strong></td>
        <td>${escapeHtml(pillar.official_description)}</td>
        <td style="text-align:right;font-weight:700;">${escapeHtml(formatted)}</td>
        <td>${escapeHtml(appreciation)}</td>
      </tr>
    `;
  }).join('');

  const examsRowsHtml = OFFICIAL_EXAM_TYPES.map((exam) => {
    const ex = scoreboard.exams[exam.code];
    return `
      <tr>
        <td>#${exam.display_order}</td>
        <td><strong>${escapeHtml(exam.short_title)}</strong></td>
        <td style="text-align:center;">${ex.evaluationCount}</td>
        <td style="text-align:right;">${escapeHtml(ex.pillars.LEADERSHIP?.formattedScore ?? '—')}</td>
        <td style="text-align:right;">${escapeHtml(ex.pillars.FORMATEUR?.formattedScore ?? '—')}</td>
        <td style="text-align:right;">${escapeHtml(ex.pillars.CONCEPTION?.formattedScore ?? '—')}</td>
        <td style="text-align:right;">${escapeHtml(ex.pillars.CONNAISSANCES?.formattedScore ?? '—')}</td>
        <td style="text-align:right;">${escapeHtml(ex.pillars.ORGANISATEUR?.formattedScore ?? '—')}</td>
        <td style="text-align:right;font-weight:700;">${escapeHtml(ex.formattedExamAverage)}</td>
      </tr>
    `;
  }).join('');

  const matrixHeadersHtml = OFFICIAL_EXAM_TYPES.map(
    (ex) => `<th style="font-size:9px;text-align:center;">${escapeHtml(ex.short_title)}</th>`
  ).join('');

  const matrixRowsHtml = evaluatorMatrix.rows
    .map((row) => {
      const cells = OFFICIAL_EXAM_TYPES.map((ex) => {
        const val = row.countsByExam[ex.code];
        return `<td style="text-align:center;">${val > 0 ? `<strong>${val}</strong>` : '·'}</td>`;
      }).join('');
      return `
        <tr>
          <td><strong>${escapeHtml(row.mnProfile.first_name)} ${escapeHtml(row.mnProfile.last_name)}</strong> (#${escapeHtml(row.mnProfile.febras_number)})</td>
          ${cells}
          <td style="text-align:center;font-weight:700;">${row.totalForEvaluator}</td>
        </tr>
      `;
    })
    .join('');

  const commentsRowsHtml = nonEmptyComments
    .map((ev) => {
      const examTitle =
        OFFICIAL_EXAM_TYPES.find((e) => e.code === ev.exam_code)?.short_title ??
        ev.exam_code;
      return `
        <tr>
          <td style="white-space:nowrap;">${escapeHtml(ev.event_date)}</td>
          <td><strong>${escapeHtml(examTitle)}</strong></td>
          <td>${escapeHtml(ev.legacy_evaluator_raw ?? 'Jury MN')}</td>
          <td style="border-left:3px solid #059669;padding-left:8px;">${escapeHtml(ev.strengths_comment)}</td>
          <td style="border-left:3px solid #d97706;padding-left:8px;">${escapeHtml(ev.improvements_comment)}</td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Dossier Officiel de Délibération CMN — ${escapeHtml(candidate.first_name)} ${escapeHtml(candidate.last_name)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.45; margin: 0; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0284c7; padding-bottom: 10px; margin-bottom: 16px; }
    .title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0; }
    .subtitle { font-size: 11px; color: #475569; margin-top: 2px; }
    .badge { display: inline-block; background: #0f172a; color: #fff; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #0369a1; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 18px; margin-bottom: 8px; }
    .grid-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
    .info-item span { display: block; font-size: 9px; text-transform: uppercase; color: #64748b; }
    .info-item strong { font-size: 11px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: top; }
    th { background: #f1f5f9; color: #334155; font-weight: 700; text-align: left; }
    .page-break { page-break-before: always; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 28px; }
    .sig-box { border: 1px dashed #94a3b8; border-radius: 6px; padding: 10px; height: 70px; font-size: 10px; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="badge">LIFRAS — COMMISSION DE L'ENSEIGNEMENT</div>
      <h1 class="title">Dossier Officiel de Délibération — Candidat Moniteur National</h1>
      <div class="subtitle">Rapport certifié par le moteur mathématique Iso-Excel • Généré le ${escapeHtml(generatedAt)}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:14px;font-weight:800;">${escapeHtml(candidate.first_name)} ${escapeHtml(candidate.last_name)}</div>
      <div>FEBRAS #${escapeHtml(candidate.febras_number)}</div>
      <div><strong>${scoreboard.totalPublishedEvaluations}</strong> évaluations publiées</div>
    </div>
  </div>

  <h2>1. Fiche Signalétique Réglementaire</h2>
  <div class="grid-info">
    <div class="info-item"><span>Identité complète</span><strong>${escapeHtml(candidate.first_name)} ${escapeHtml(candidate.last_name)}</strong></div>
    <div class="info-item"><span>Matricule FEBRAS (TEXT)</span><strong>${escapeHtml(candidate.febras_number)}</strong></div>
    <div class="info-item"><span>Club affilié</span><strong>${escapeHtml(candidate.club_name)}</strong></div>
    <div class="info-item"><span>Date de naissance</span><strong>${escapeHtml(candidate.birth_date)}</strong></div>
    <div class="info-item"><span>Coordonnées GSM / Fixe</span><strong>${escapeHtml(candidate.phone_gsm)} / ${escapeHtml(candidate.phone_landline)}</strong></div>
    <div class="info-item"><span>Adresse e-mail</span><strong>${escapeHtml(candidate.email)}</strong></div>
    <div class="info-item"><span>Domicile</span><strong>${escapeHtml(candidate.street_address)}, ${escapeHtml(candidate.postal_code)} ${escapeHtml(candidate.city)}</strong></div>
    <div class="info-item"><span>Brevets CFPS / MF & Plongées</span><strong>CFPS ${escapeHtml(candidate.cfps_year)} • MF ${escapeHtml(candidate.mf_year)} • ${escapeHtml(candidate.dives_count)} plongées</strong></div>
    <div class="info-item"><span>Président & Chef d'École</span><strong>${escapeHtml(candidate.club_president)} / ${escapeHtml(candidate.club_head_instructor)}</strong></div>
  </div>

  <h2>2. Synthèse des 5 Piliers de Compétences du Moniteur National</h2>
  <table>
    <thead>
      <tr>
        <th style="width:22%;">Pilier</th>
        <th>Définition Officielle LIFRAS</th>
        <th style="width:12%;text-align:right;">Score Iso-Excel</th>
        <th style="width:18%;">Appréciation</th>
      </tr>
    </thead>
    <tbody>
      ${pillarsRowsHtml}
    </tbody>
  </table>

  <h2>3. Détail des 10 Épreuves Réglementaires</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Épreuve</th>
        <th style="text-align:center;">Évals</th>
        <th style="text-align:right;">Leadership</th>
        <th style="text-align:right;">Formateur</th>
        <th style="text-align:right;">Conception</th>
        <th style="text-align:right;">Connaissances</th>
        <th style="text-align:right;">Organisateur</th>
        <th style="text-align:right;">Moyenne Épreuve</th>
      </tr>
    </thead>
    <tbody>
      ${examsRowsHtml}
    </tbody>
  </table>

  <div class="page-break"></div>

  <h2>4. Matrice Croisée de Diversité des Jurys (Moniteurs Nationaux × Épreuves)</h2>
  <table>
    <thead>
      <tr>
        <th>Moniteur National Examinateur</th>
        ${matrixHeadersHtml}
        <th style="text-align:center;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${matrixRowsHtml}
    </tbody>
  </table>

  <h2>5. Journal Intégral des Commentaires Pédagogiques (${nonEmptyComments.length} prestations)</h2>
  <table>
    <thead>
      <tr>
        <th style="width:10%;">Date</th>
        <th style="width:16%;">Épreuve</th>
        <th style="width:18%;">Jury MN</th>
        <th style="width:28%;">Ce que le CMN doit garder (Col. DE)</th>
        <th style="width:28%;">Ce que le CMN doit améliorer (Col. DD)</th>
      </tr>
    </thead>
    <tbody>
      ${commentsRowsHtml}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-box"><strong>Le Candidat Moniteur National</strong><br/>${escapeHtml(candidate.first_name)} ${escapeHtml(candidate.last_name)}</div>
    <div class="sig-box"><strong>Le Parrain Moniteur National</strong><br/>Visa & Date</div>
    <div class="sig-box"><strong>Pour le Collège National / DTF LIFRAS</strong><br/>Délibération & Signature</div>
  </div>
</body>
</html>`;
}

/**
 * Ouvre le rapport officiel A4 dans une fenêtre d'impression dédiée et déclenche l'export PDF natif.
 */
export function triggerOfficialPdfExport(
  payload: OfficialDeliberationReportPayload
): void {
  const html = buildOfficialPdfReportHtml(payload);
  const printWin = window.open('', '_blank', 'width=1024,height=800');
  if (!printWin) {
    // Repli en téléchargement direct du dossier paginé si les popups sont bloquées
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Dossier_Deliberation_CMN_${payload.candidate.last_name}_${payload.candidate.first_name}.html`;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => {
    printWin.print();
  }, 250);
}
