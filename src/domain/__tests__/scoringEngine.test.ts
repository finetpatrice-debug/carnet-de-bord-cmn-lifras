import { describe, expect, it } from 'vitest';
import {
  GRADE_WEIGHTS,
  computeCandidateScoreboard,
  computePillarCellFromCounts,
  computeScoreboardFromDistributions,
  type DirectExamDistributionsInput,
  type GradeDistributionCounts,
} from '../scoringEngine';
import type {
  Criterion,
  Evaluation,
  EvaluationScore,
  ExamCode,
  GradeCode,
  PillarCode,
} from '../types';
import { EXAM_PILLAR_MATRIX } from '../referentials';

/**
 * GOLDEN DATASET OFFICIEL (Dossier témoin de 20 évaluations)
 */
const GOLDEN_DATASET_DISTRIBUTIONS: Record<ExamCode, DirectExamDistributionsInput> = {
  COURS_MF: {
    evaluationCount: 1,
    pillars: {
      LEADERSHIP: { TB: 3 },
      FORMATEUR: { TB: 3 },
      CONNAISSANCES: { TB: 2 },
    },
  },
  PEDA_AM_MC: {
    evaluationCount: 4,
    pillars: {
      LEADERSHIP: { TB: 6, B: 2 },
      FORMATEUR: { TB: 12, B: 4 },
      CONNAISSANCES: { TB: 4 },
    },
  },
  FORMATION_MF_REG: {
    evaluationCount: 2,
    pillars: {
      LEADERSHIP: { TB: 6 },
      FORMATEUR: { TB: 11, NE: 1 },
      CONNAISSANCES: { TB: 3, NE: 1 },
    },
  },
  STAGE_EXPERIENCE: {
    evaluationCount: 6,
    pillars: {
      LEADERSHIP: { TB: 2, B: 7, S: 6, I: 2, NE: 1 },
      ORGANISATEUR: { TB: 3, B: 6, S: 8, NE: 7 },
      CONNAISSANCES: { TB: 3, B: 3, S: 5, NE: 1 },
    },
  },
  TRAVAIL_POLE: {
    evaluationCount: 1,
    pillars: {
      CONCEPTION: { TB: 4, NE: 1 },
      CONNAISSANCES: { TB: 1 },
    },
  },
  EXAMEN_THEORIQUE: {
    evaluationCount: 3,
    pillars: {
      CONNAISSANCES: { B: 2, S: 1 },
      FORMATEUR: { B: 1, S: 2 },
    },
  },
  GESTION_DEBAT: {
    evaluationCount: 1,
    pillars: {
      LEADERSHIP: { S: 2, I: 1 },
      CONCEPTION: { B: 2, S: 2 },
      CONNAISSANCES: { TB: 1 },
    },
  },
  ORGA_MER: {
    evaluationCount: 1,
    pillars: {
      LEADERSHIP: { S: 3, I: 1 },
      ORGANISATEUR: { B: 1, S: 3 },
      CONNAISSANCES: { B: 1 },
    },
  },
  ORGA_CARRIERE: {
    evaluationCount: 1,
    pillars: {
      LEADERSHIP: { TB: 4 },
      FORMATEUR: { TB: 2 },
      ORGANISATEUR: { TB: 2, B: 1, NE: 1 },
      CONNAISSANCES: { TB: 2 },
    },
  },
  STAGE_FINAL: {
    evaluationCount: 0,
    pillars: {},
  },
};

describe('Moteur Mathématique « Iso-Excel » (scoringEngine.ts)', () => {
  it('1. Vérifie le barème officiel strict GRADE_WEIGHTS et la gestion de NE', () => {
    expect(GRADE_WEIGHTS).toEqual({
      TB: 10,
      B: 8,
      S: 6,
      I: 4,
      M: 2,
    });

    // Cellule avec uniquement des NE : J = 0, K = 0, L = 0 (aucune division par zéro)
    const onlyNeCell = computePillarCellFromCounts('STAGE_FINAL', 'LEADERSHIP', {
      NE: 5,
    });
    expect(onlyNeCell.counts.NE).toBe(5);
    expect(onlyNeCell.J).toBe(0);
    expect(onlyNeCell.K).toBe(0);
    expect(onlyNeCell.L).toBe(0);
    expect(onlyNeCell.formattedScore).toBe('Non évalué');
  });

  it('2. Certifie le Golden Dataset (20 évaluations témoins) sur les 10 épreuves et les 5 piliers (Mode ISO_EXCEL)', () => {
    const result = computeScoreboardFromDistributions(
      GOLDEN_DATASET_DISTRIBUTIONS,
      'ISO_EXCEL'
    );

    // Total des évaluations publiées = 20
    expect(result.totalPublishedEvaluations).toBe(20);

    // Vérification du nombre d'évaluations par épreuve
    expect(result.exams.COURS_MF.evaluationCount).toBe(1);
    expect(result.exams.PEDA_AM_MC.evaluationCount).toBe(4);
    expect(result.exams.FORMATION_MF_REG.evaluationCount).toBe(2);
    expect(result.exams.STAGE_EXPERIENCE.evaluationCount).toBe(6);
    expect(result.exams.TRAVAIL_POLE.evaluationCount).toBe(1);
    expect(result.exams.EXAMEN_THEORIQUE.evaluationCount).toBe(3);
    expect(result.exams.GESTION_DEBAT.evaluationCount).toBe(1);
    expect(result.exams.ORGA_MER.evaluationCount).toBe(1);
    expect(result.exams.ORGA_CARRIERE.evaluationCount).toBe(1);
    expect(result.exams.STAGE_FINAL.evaluationCount).toBe(0);

    // Vérification des moyennes des 10 épreuves à 4 décimales (toBeCloseTo(..., 4))
    expect(result.exams.COURS_MF.examAverage).toBeCloseTo(1.0000, 4);
    expect(result.exams.COURS_MF.formattedExamAverage).toBe('100,00 %');

    expect(result.exams.PEDA_AM_MC.examAverage).toBeCloseTo(0.9667, 4);
    expect(result.exams.PEDA_AM_MC.formattedExamAverage).toBe('96,67 %');

    expect(result.exams.FORMATION_MF_REG.examAverage).toBeCloseTo(1.0000, 4);
    expect(result.exams.FORMATION_MF_REG.formattedExamAverage).toBe('100,00 %');

    expect(result.exams.STAGE_EXPERIENCE.examAverage).toBeCloseTo(0.7369, 4);
    expect(result.exams.STAGE_EXPERIENCE.formattedExamAverage).toBe('73,69 %');

    expect(result.exams.TRAVAIL_POLE.examAverage).toBeCloseTo(1.0000, 4);
    expect(result.exams.TRAVAIL_POLE.formattedExamAverage).toBe('100,00 %');

    expect(result.exams.EXAMEN_THEORIQUE.examAverage).toBeCloseTo(0.7000, 4);
    expect(result.exams.EXAMEN_THEORIQUE.formattedExamAverage).toBe('70,00 %');

    expect(result.exams.GESTION_DEBAT.examAverage).toBeCloseTo(0.7444, 4);
    expect(result.exams.GESTION_DEBAT.formattedExamAverage).toBe('74,44 %');

    expect(result.exams.ORGA_MER.examAverage).toBeCloseTo(0.6667, 4);
    expect(result.exams.ORGA_MER.formattedExamAverage).toBe('66,67 %');

    expect(result.exams.ORGA_CARRIERE.examAverage).toBeCloseTo(0.9833, 4);
    expect(result.exams.ORGA_CARRIERE.formattedExamAverage).toBe('98,33 %');

    // STAGE_FINAL (0 éval) -> null (jamais NaN ni #DIV/0!)
    expect(result.exams.STAGE_FINAL.examAverage).toBeNull();
    expect(result.exams.STAGE_FINAL.formattedExamAverage).toBe('Non évalué');

    // Vérification des scores globaux des 5 piliers attendus
    expect(result.globalPillarScores.LEADERSHIP).toBeCloseTo(0.8199, 4);
    expect(result.formattedGlobalPillarScores.LEADERSHIP).toBe('81,99 %');

    expect(result.globalPillarScores.FORMATEUR).toBeCloseTo(0.9233, 4);
    expect(result.formattedGlobalPillarScores.FORMATEUR).toBe('92,33 %');

    expect(result.globalPillarScores.CONNAISSANCES).toBeCloseTo(0.9219, 4);
    expect(result.formattedGlobalPillarScores.CONNAISSANCES).toBe('92,19 %');

    expect(result.globalPillarScores.CONCEPTION).toBeCloseTo(0.8500, 4);
    expect(result.formattedGlobalPillarScores.CONCEPTION).toBe('85,00 %');

    expect(result.globalPillarScores.ORGANISATEUR).toBeCloseTo(0.7748, 4);
    expect(result.formattedGlobalPillarScores.ORGANISATEUR).toBe('77,48 %');
  });

  it('3. Certifie computeCandidateScoreboard à partir des enregistrements relationnels (evaluations, evaluation_scores, criteria)', () => {
    // Construction d'un jeu d'enregistrements relationnels produisant exactement le Golden Dataset
    const criteria: Criterion[] = [];
    const evaluations: Pick<Evaluation, 'id' | 'exam_code' | 'status'>[] = [];
    const evaluationScores: EvaluationScore[] = [];

    let criterionIdCounter = 1;
    let evalIdCounter = 1;

    const gradesOrder: GradeCode[] = ['TB', 'B', 'S', 'I', 'M', 'NE'];

    (Object.keys(GOLDEN_DATASET_DISTRIBUTIONS) as ExamCode[]).forEach((examCode) => {
      const dist = GOLDEN_DATASET_DISTRIBUTIONS[examCode];
      const pillarList = EXAM_PILLAR_MATRIX[examCode];

      // Créer les évaluations PUBLISHED pour cette épreuve
      const examEvalIds: string[] = [];
      for (let i = 0; i < dist.evaluationCount; i++) {
        const evalId = `eval-${evalIdCounter++}`;
        examEvalIds.push(evalId);
        evaluations.push({
          id: evalId,
          exam_code: examCode,
          status: 'PUBLISHED',
        });
      }

      // Ajouter une évaluation DRAFT et une ARCHIVED pour vérifier qu'elles sont bien ignorées
      const ignoredDraftId = `eval-draft-${examCode}`;
      evaluations.push({
        id: ignoredDraftId,
        exam_code: examCode,
        status: 'DRAFT',
      });

      // Créer des critères pour chaque pilier et injecter les notes exactes sur la 1ère évaluation publiée
      pillarList.forEach((pillarCode: PillarCode) => {
        const counts: Partial<GradeDistributionCounts> =
          dist.pillars[pillarCode] ?? {};

        gradesOrder.forEach((grade) => {
          const countForGrade = counts[grade] ?? 0;
          for (let c = 0; c < countForGrade; c++) {
            const cId = criterionIdCounter++;
            criteria.push({
              id: cId,
              excel_col: `COL_${cId}`,
              exam_code: examCode,
              pillar_code: pillarCode,
              order_in_exam: cId,
              question_text: `Question ${cId}`,
              is_active: true,
            });

            if (examEvalIds.length > 0) {
              evaluationScores.push({
                evaluation_id: examEvalIds[0],
                criterion_id: cId,
                grade,
              });
            }

            // Note parasite sur l'évaluation DRAFT (doit être ignorée)
            evaluationScores.push({
              evaluation_id: ignoredDraftId,
              criterion_id: cId,
              grade: 'M',
            });
          }
        });
      });
    });

    const relationalResult = computeCandidateScoreboard(
      evaluations,
      evaluationScores,
      criteria,
      'ISO_EXCEL'
    );

    expect(relationalResult.totalPublishedEvaluations).toBe(20);
    expect(relationalResult.exams.STAGE_EXPERIENCE.evaluationCount).toBe(6);
    expect(relationalResult.exams.STAGE_FINAL.evaluationCount).toBe(0);
    expect(relationalResult.exams.STAGE_FINAL.examAverage).toBeNull();

    expect(relationalResult.globalPillarScores.LEADERSHIP).toBeCloseTo(0.8199, 4);
    expect(relationalResult.globalPillarScores.FORMATEUR).toBeCloseTo(0.9233, 4);
    expect(relationalResult.globalPillarScores.CONNAISSANCES).toBeCloseTo(0.9219, 4);
    expect(relationalResult.globalPillarScores.CONCEPTION).toBeCloseTo(0.8500, 4);
    expect(relationalResult.globalPillarScores.ORGANISATEUR).toBeCloseTo(0.7748, 4);
  });

  it('4. Vérifie le mode optionnel WEIGHTED (pondéré par le nombre réel d’évaluations)', () => {
    const weightedResult = computeScoreboardFromDistributions(
      GOLDEN_DATASET_DISTRIBUTIONS,
      'WEIGHTED'
    );

    expect(weightedResult.scoringMode).toBe('WEIGHTED');
    // Pour CONCEPTION : TRAVAIL_POLE (1 éval, L=1.0) et GESTION_DEBAT (1 éval, L=0.7) -> moyenne pondérée = 0.8500
    expect(weightedResult.globalPillarScores.CONCEPTION).toBeCloseTo(0.8500, 4);
    // Pour FORMATEUR : (1*1 + 4*0.95 + 2*1 + 3*(2/3) + 1*1) / 11 = 9.8 / 11 = 0.8909 (vs 0.9233 en ISO_EXCEL)
    expect(weightedResult.globalPillarScores.FORMATEUR).toBeCloseTo(0.8909, 4);
    // Pour ORGANISATEUR : (6*(126/170) + 1*0.65 + 1*(28/30)) / 8 = 0.7538 (vs 0.7748 en ISO_EXCEL)
    expect(weightedResult.globalPillarScores.ORGANISATEUR).toBeCloseTo(0.7538, 4);
  });
});
