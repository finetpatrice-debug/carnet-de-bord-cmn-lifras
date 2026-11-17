import { describe, expect, it } from 'vitest';
import {
  buildSampleGoldenWorkbookBuffer,
  normalizeBelgianGsm,
  parseCmnExcelWorkbook,
} from '../excelImporter';
import { resolveJuryCell, splitEvaluatorRawString } from '../juryNormalizer';
import {
  buildCriterionMappingProposals,
  executeExamReclassification,
} from '@/features/admin/reclassificationService';
import type { Profile } from '@/domain/types';

const TEST_MN_DIRECTORY: Pick<
  Profile,
  'id' | 'first_name' | 'last_name' | 'aliases'
>[] = [
  {
    id: 'mn-1',
    first_name: 'Jean-Marc',
    last_name: 'Lambert',
    aliases: ['J-M Lambert'],
  },
  {
    id: 'mn-2',
    first_name: 'Claire',
    last_name: 'Dubois',
    aliases: [],
  },
  {
    id: 'mn-3',
    first_name: 'Philippe',
    last_name: 'Hendrickx',
    aliases: [],
  },
];

describe('Module Import Excel, Dédoublonnage Jurys MN & Reclassement DTF', () => {
  it('1. Rétablit le 0 initial belge sur un GSM à 9 chiffres commençant par 4', () => {
    const res1 = normalizeBelgianGsm(479445566);
    expect(res1.formatted).toBe('0479445566');
    expect(res1.zeroRestored).toBe(true);

    const res2 = normalizeBelgianGsm('0475123456');
    expect(res2.formatted).toBe('0475123456');
    expect(res2.zeroRestored).toBe(false);
  });

  it('2. Découpe et apparie les jurys multiples (, / & / et) avec inversion Nom/Prénom et alias', () => {
    const tokens = splitEvaluatorRawString(
      'Lambert Jean-Marc & Dubois Claire, J-M Lambert et Hendrickx Philippe'
    );
    expect(tokens).toEqual([
      'Lambert Jean-Marc',
      'Dubois Claire',
      'J-M Lambert',
      'Hendrickx Philippe',
    ]);

    const matches = resolveJuryCell(
      'Lambert Jean-Marc & Dubois Claire et J-M Lambert',
      TEST_MN_DIRECTORY
    );
    expect(matches).toHaveLength(3);
    expect(matches[0].matchedProfileId).toBe('mn-1');
    expect(matches[0].matchMethod).toBe('INVERTED');
    expect(matches[1].matchedProfileId).toBe('mn-2');
    expect(matches[1].matchMethod).toBe('INVERTED');
    expect(matches[2].matchedProfileId).toBe('mn-1');
    expect(matches[2].matchMethod).toBe('ALIAS');
  });

  it('3. Extrait intégralement un classeur .xlsx (Informations personnelles D11..D36 + Données I..DE) et certifie les 5 moyennes Iso-Excel', () => {
    const buffer = buildSampleGoldenWorkbookBuffer();
    const preview = parseCmnExcelWorkbook(
      buffer,
      'Golden_CMN.xlsx',
      TEST_MN_DIRECTORY
    );

    // Fiche candidat extraite de Informations personnelles
    expect(preview.candidate.last_name).toBe('Peeters');
    expect(preview.candidate.first_name).toBe('Thomas');
    expect(preview.candidate.phone_gsm).toBe('0479445566');
    expect(preview.candidate.gsm_zero_restored).toBe(true);
    expect(preview.candidate.febras_number).toBe('0054321');
    expect(preview.candidate.cfps_year).toBe(2099);
    expect(preview.candidate.cfps_year_warning).toContain('futur');
    expect(preview.candidate.club_name).toBe('Nautilus Club');

    // 20 évaluations extraites de la feuille Données
    expect(preview.evaluations).toHaveLength(20);
    expect(preview.scoreboardPreview.totalPublishedEvaluations).toBe(20);

    // Contrôle des 5 moyennes globales Iso-Excel avant import
    expect(preview.scoreboardPreview.globalPillarScores.LEADERSHIP).toBeCloseTo(
      0.8199,
      4
    );
    expect(preview.scoreboardPreview.globalPillarScores.FORMATEUR).toBeCloseTo(
      0.9233,
      4
    );
    expect(
      preview.scoreboardPreview.globalPillarScores.CONNAISSANCES
    ).toBeCloseTo(0.9219, 4);
    expect(preview.scoreboardPreview.globalPillarScores.CONCEPTION).toBeCloseTo(
      0.8500,
      4
    );
    expect(
      preview.scoreboardPreview.globalPillarScores.ORGANISATEUR
    ).toBeCloseTo(0.7748, 4);
  });

  it('4. Reclasse une épreuve mal aiguillée avec mapping assisté des critères communs et journalisation dans audit_logs', () => {
    const proposals = buildCriterionMappingProposals(
      'COURS_MF',
      'PEDA_AM_MC',
      [
        { evaluation_id: 'ev-1', criterion_id: 1, grade: 'TB' }, // Prestance MN (Col I -> Col Q)
        { evaluation_id: 'ev-1', criterion_id: 2, grade: 'B' },  // Capacités d'écoute (Col J -> Col R)
        { evaluation_id: 'ev-1', criterion_id: 8, grade: 'TB' }, // Protocoles et règlements (Col P -> Col W)
      ]
    );

    const prestanceMap = proposals.find((p) => p.sourceCriterion.id === 1);
    expect(prestanceMap?.suggestedTargetCriterion?.id).toBe(9); // Critère 9 (Col Q) dans PEDA_AM_MC

    const ecouteMap = proposals.find((p) => p.sourceCriterion.id === 2);
    expect(ecouteMap?.suggestedTargetCriterion?.id).toBe(10); // Critère 10 (Col R) dans PEDA_AM_MC

    const reglementsMap = proposals.find((p) => p.sourceCriterion.id === 8);
    expect(reglementsMap?.suggestedTargetCriterion?.id).toBe(15); // Critère 15 (Col W) dans PEDA_AM_MC

    // Exécution du reclassement avec motif obligatoire
    const result = executeExamReclassification({
      evaluation: {
        id: 'ev-1',
        legacy_row_id: 14,
        candidate_id: 'cand-1',
        exam_code: 'COURS_MF',
        lead_evaluator_id: 'mn-1',
        legacy_evaluator_raw: 'Lambert Jean-Marc',
        event_date: '2026-03-18',
        started_at: null,
        submitted_at: null,
        improvements_comment: 'À améliorer',
        strengths_comment: 'À garder',
        status: 'PUBLISHED',
        created_at: '2026-03-18T10:00:00Z',
        updated_at: '2026-03-18T10:00:00Z',
      },
      currentScores: [{ evaluation_id: 'ev-1', criterion_id: 1, grade: 'TB' }],
      targetExamCode: 'PEDA_AM_MC',
      mappedTargetGrades: { 9: 'TB', 10: 'B', 15: 'TB' },
      actorId: 'admin-dtf-001',
      reason: 'Erreur de sélection MS Forms par le jury (séance AM/MC)',
    });

    expect(result.updatedEvaluation.exam_code).toBe('PEDA_AM_MC');
    expect(result.updatedScores).toHaveLength(7); // 7 critères dans PEDA_AM_MC
    expect(result.auditLogEntry.action).toBe('RECLASSIFY_EXAM_TYPE');
    expect(result.auditLogEntry.reason).toContain('Erreur de sélection MS Forms');
    expect(result.auditLogEntry.previous_value).toEqual({
      exam_code: 'COURS_MF',
      scores: [{ criterion_id: 1, grade: 'TB' }],
    });
  });
});
