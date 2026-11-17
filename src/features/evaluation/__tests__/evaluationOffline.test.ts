import { describe, expect, it } from 'vitest';
import { OFFICIAL_CRITERIA, OFFICIAL_EXAM_TYPES } from '@/domain/referentials';
import { computeExamAverage } from '@/domain/scoringEngine';
import type { EvaluationScore, ExamCode } from '@/domain/types';

describe('Formulaire Mobile Terrain (PWA Offline-First) — Validation & Grille par Pilier', () => {
  it('1. Charge exactement le bon nombre de questions actives pour chacune des 10 épreuves réglementaires', () => {
    const expectedCounts: Record<ExamCode, number> = {
      COURS_MF: 8,
      PEDA_AM_MC: 7,
      FORMATION_MF_REG: 11,
      STAGE_EXPERIENCE: 9,
      TRAVAIL_POLE: 6,
      EXAMEN_THEORIQUE: 2,
      GESTION_DEBAT: 8,
      ORGA_MER: 9,
      ORGA_CARRIERE: 12,
      DIRECTEUR_PLONGEE: 8,
      STAGE_FINAL: 27,
    };

    let sumAll = 0;
    for (const exam of OFFICIAL_EXAM_TYPES) {
      const activeForExam = OFFICIAL_CRITERIA.filter(
        (c) => c.exam_code === exam.code && c.is_active
      );
      expect(activeForExam).toHaveLength(expectedCounts[exam.code]);
      sumAll += activeForExam.length;
    }

    expect(sumAll).toBe(107);
  });

  it('2. Calcule en temps réel la moyenne Iso-Excel lors de la saisie tactile avec prise en compte de NE', () => {
    const pedaCriteria = OFFICIAL_CRITERIA.filter(
      (c) => c.exam_code === 'PEDA_AM_MC' && c.is_active
    );

    const scores: EvaluationScore[] = [
      // LEADERSHIP (Q, R) : 2 TB -> L = 1.00
      { evaluation_id: 'mob-1', criterion_id: 9, grade: 'TB' },
      { evaluation_id: 'mob-1', criterion_id: 10, grade: 'TB' },
      // FORMATEUR (S, T, U, V) : 2 TB, 1 B, 1 NE -> (20+8)/30 = 0.9333
      { evaluation_id: 'mob-1', criterion_id: 11, grade: 'TB' },
      { evaluation_id: 'mob-1', criterion_id: 12, grade: 'TB' },
      { evaluation_id: 'mob-1', criterion_id: 13, grade: 'B' },
      { evaluation_id: 'mob-1', criterion_id: 14, grade: 'NE' },
      // CONNAISSANCES (W) : 1 NE -> L = 0 (exclu de la moyenne d'épreuve)
      { evaluation_id: 'mob-1', criterion_id: 15, grade: 'NE' },
    ];

    const avgRes = computeExamAverage('PEDA_AM_MC', pedaCriteria, scores);
    // Seuls LEADERSHIP (1.0) et FORMATEUR (28/30 = 0.93333) ont L > 0 -> moyenne = 0.9667
    expect(avgRes.average).toBeCloseTo(0.9667, 4);
    expect(avgRes.formattedAverage).toBe('96,67 %');
  });
});
