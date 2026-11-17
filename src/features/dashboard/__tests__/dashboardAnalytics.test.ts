import { describe, expect, it } from 'vitest';
import {
  buildEvaluatorCrossMatrix,
  buildPillarChronologicalSeries,
  getPillarStatusVisuals,
} from '../dashboardAnalytics';
import { buildOfficialPdfReportHtml } from '../pdfDeliberationExporter';
import {
  buildSampleGoldenWorkbookBuffer,
  parseCmnExcelWorkbook,
} from '@/features/import/excelImporter';
import type { Evaluation, Profile } from '@/domain/types';

const TEST_MN_LIST: Profile[] = [
  {
    id: 'mn-1',
    role: 'MN_EVALUATOR',
    cohort_id: 'cohort-2026',
    sponsor_mn_id: null,
    last_name: 'Lambert',
    first_name: 'Jean-Marc',
    birth_date: null,
    street_address: null,
    postal_code: null,
    city: null,
    phone_landline: null,
    phone_gsm: '0475987654',
    email: 'jm@lifras.be',
    febras_number: '0023456',
    cfps_year: 2008,
    mf_year: 2011,
    dives_count: 1400,
    club_name: 'CAS Liège',
    club_president: null,
    club_head_instructor: null,
    club_head_gsm: null,
    photo_storage_path: null,
    aliases: ['J-M Lambert'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mn-2',
    role: 'MN_EVALUATOR',
    cohort_id: 'cohort-2026',
    sponsor_mn_id: null,
    last_name: 'Dubois',
    first_name: 'Claire',
    birth_date: null,
    street_address: null,
    postal_code: null,
    city: null,
    phone_landline: null,
    phone_gsm: '0472112233',
    email: 'claire@lifras.be',
    febras_number: '0034567',
    cfps_year: 2010,
    mf_year: 2013,
    dives_count: 1150,
    club_name: 'Namur Plongée',
    club_president: null,
    club_head_instructor: null,
    club_head_gsm: null,
    photo_storage_path: null,
    aliases: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

describe('Sprint 5 — Cockpit Analytique CMN, Matrice des Jurys & Export PDF Officiel', () => {
  it('1. Applique le code couleur pédagogique réglementaire (>=80% vert, 60-79% ambre, <60% rouge)', () => {
    expect(getPillarStatusVisuals(0.85).levelLabel).toContain('Maîtrise');
    expect(getPillarStatusVisuals(0.72).levelLabel).toContain(
      'Acquis à consolider'
    );
    expect(getPillarStatusVisuals(0.55).levelLabel).toContain('Vigilance');
    expect(getPillarStatusVisuals(0).levelLabel).toBe('Non évalué');
  });

  it('2. Calcule la Matrice Croisée des Examinateurs et la série chronologique par pilier', () => {
    const evals: Evaluation[] = [
      {
        id: 'ev-1',
        legacy_row_id: 1,
        candidate_id: 'cand-1',
        exam_code: 'COURS_MF',
        lead_evaluator_id: 'mn-1',
        legacy_evaluator_raw: 'Lambert Jean-Marc & Dubois Claire',
        event_date: '2026-02-10',
        started_at: null,
        submitted_at: null,
        improvements_comment: 'RAS',
        strengths_comment: 'TB',
        status: 'PUBLISHED',
        created_at: '2026-02-10T10:00:00Z',
        updated_at: '2026-02-10T10:00:00Z',
      },
    ];

    const matrix = buildEvaluatorCrossMatrix(evals, TEST_MN_LIST);
    expect(matrix.rows[0].countsByExam.COURS_MF).toBe(1);
    expect(matrix.rows[1].countsByExam.COURS_MF).toBe(1);
    expect(matrix.columnTotals.COURS_MF).toBe(2);
    expect(matrix.grandTotal).toBe(2);

    const series = buildPillarChronologicalSeries('LEADERSHIP', evals, [
      { evaluation_id: 'ev-1', criterion_id: 1, grade: 'TB' },
      { evaluation_id: 'ev-1', criterion_id: 2, grade: 'TB' },
      { evaluation_id: 'ev-1', criterion_id: 3, grade: 'TB' },
    ]);
    expect(series).toHaveLength(1);
    expect(series[0].scorePercent).toBe(100);
  });

  it('3. Génère le rapport HTML A4 officiel de délibération paginé et horodaté', () => {
    const buffer = buildSampleGoldenWorkbookBuffer();
    const parsed = parseCmnExcelWorkbook(
      buffer,
      'Golden.xlsx',
      TEST_MN_LIST
    );

    const candidateProfile: Profile = {
      id: 'cand-tp',
      role: 'CMN_CANDIDATE',
      cohort_id: 'cohort-2026',
      sponsor_mn_id: 'mn-2',
      last_name: parsed.candidate.last_name,
      first_name: parsed.candidate.first_name,
      birth_date: parsed.candidate.birth_date,
      street_address: parsed.candidate.street_address,
      postal_code: parsed.candidate.postal_code,
      city: parsed.candidate.city,
      phone_landline: parsed.candidate.phone_landline,
      phone_gsm: parsed.candidate.phone_gsm,
      email: parsed.candidate.email,
      febras_number: parsed.candidate.febras_number,
      cfps_year: parsed.candidate.cfps_year,
      mf_year: parsed.candidate.mf_year,
      dives_count: parsed.candidate.dives_count,
      club_name: parsed.candidate.club_name,
      club_president: parsed.candidate.club_president,
      club_head_instructor: parsed.candidate.club_head_instructor,
      club_head_gsm: null,
      photo_storage_path: null,
      aliases: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const matrix = buildEvaluatorCrossMatrix([], TEST_MN_LIST);
    const html = buildOfficialPdfReportHtml({
      candidate: candidateProfile,
      scoreboard: parsed.scoreboardPreview,
      evaluations: [],
      evaluatorMatrix: matrix,
    });

    expect(html).toContain('Dossier Officiel de Délibération');
    expect(html).toContain('Thomas Peeters');
    expect(html).toContain('81,99 %');
    expect(html).toContain('92,33 %');
    expect(html).toContain('0054321');
  });
});
