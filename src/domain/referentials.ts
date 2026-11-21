import type { Criterion, ExamCode, ExamType, Pillar, PillarCode } from './types';

export const APP_VERSION = 'v2.0.13';

export const OFFICIAL_PILLARS: Pillar[] = [
  {
    code: 'LEADERSHIP',
    title: 'Leadership',
    official_description:
      "Grâce aux compétences et connaissances maîtrisées, le Moniteur National est un leader qui guide et inspire naturellement les plongeurs et les moniteurs qu'il côtoie, tout en consacrant du temps à la Commission de l'Enseignement.",
    display_order: 1,
  },
  {
    code: 'FORMATEUR',
    title: "Formateur d'instructeurs",
    official_description:
      "Le Moniteur National forme et évalue les instructeurs de plongée. Il est capable d'aider tout moniteur à se perfectionner à tous les niveaux et notamment en pédagogie.",
    display_order: 2,
  },
  {
    code: 'CONCEPTION',
    title: 'Capacité de conception en groupe',
    official_description:
      "Le Moniteur National possède un esprit d'analyse, un esprit critique, de la créativité et la capacité de travailler en équipe pour faire évoluer l'enseignement et les règles de la plongée au sein de la ligue.",
    display_order: 3,
  },
  {
    code: 'CONNAISSANCES',
    title: 'Connaissances théoriques',
    official_description:
      "Étant le plus haut brevet de moniteur de la ligue, le Moniteur National possède des connaissances théoriques et pratiques étendues (médecine, urgence, organisation, mer, lois et réglementations) et constitue une référence fiable.",
    display_order: 4,
  },
  {
    code: 'ORGANISATEUR',
    title: 'Organisateur',
    official_description:
      "Le Moniteur National possède les connaissances et l'expérience nécessaires à l'organisation efficace de tous types d'activités de plongée de grande ampleur (composition des palanquées, sécurité, briefings, gestion d'incident).",
    display_order: 5,
  },
];

export const OFFICIAL_EXAM_TYPES: ExamType[] = [
  {
    code: 'COURS_MF',
    short_title: 'Cours CMF',
    forms_label: 'Cours niveau MF',
    display_order: 1,
  },
  {
    code: 'PEDA_AM_MC',
    short_title: 'Pédagogie AM-MC',
    forms_label: 'Pédagogie AM ou MC',
    display_order: 2,
  },
  {
    code: 'FORMATION_MF_REG',
    short_title: 'Formation MF (Ass. Rég.)',
    forms_label: "Formation d'un MF (dans une association régionale)",
    display_order: 3,
  },
  {
    code: 'STAGE_EXPERIENCE',
    short_title: "Stage d'expérience",
    forms_label: "Stage d'expérience",
    display_order: 4,
  },
  {
    code: 'TRAVAIL_POLE',
    short_title: 'Travail dans un pôle',
    forms_label: "Travail pour la commission de l'enseignement (dans un pôle par exemple)",
    display_order: 5,
  },
  {
    code: 'EXAMEN_THEORIQUE',
    short_title: 'Examen théorique',
    forms_label: 'Examen théorique',
    display_order: 6,
  },
  {
    code: 'GESTION_DEBAT',
    short_title: 'Gestion de débat',
    forms_label: "Gestion d'un débat",
    display_order: 7,
  },
  {
    code: 'ORGA_MER',
    short_title: 'Organisation Mer',
    forms_label: 'Examen organisation mer',
    display_order: 8,
  },
  {
    code: 'ORGA_CARRIERE',
    short_title: 'Organisation Carrière',
    forms_label: 'Examen organisation carrière',
    display_order: 9,
  },
  {
    code: 'DIRECTEUR_PLONGEE',
    short_title: 'Directeur de plongée',
    forms_label: 'Directeur de plongée',
    display_order: 10,
  },
  {
    code: 'STAGE_FINAL',
    short_title: 'Stage Final',
    forms_label: 'Stage final',
    display_order: 11,
  },
];

/**
 * Couples officiels (exam_code, pillar_code) présents dans la table des critères.
 */
export const EXAM_PILLAR_MATRIX: Record<ExamCode, PillarCode[]> = {
  COURS_MF: ['LEADERSHIP', 'FORMATEUR', 'CONNAISSANCES'],
  PEDA_AM_MC: ['LEADERSHIP', 'FORMATEUR', 'CONNAISSANCES'],
  FORMATION_MF_REG: ['LEADERSHIP', 'FORMATEUR', 'CONNAISSANCES'],
  STAGE_EXPERIENCE: ['LEADERSHIP', 'ORGANISATEUR', 'CONNAISSANCES'],
  TRAVAIL_POLE: ['CONCEPTION', 'CONNAISSANCES'],
  EXAMEN_THEORIQUE: ['CONNAISSANCES', 'FORMATEUR'],
  GESTION_DEBAT: ['LEADERSHIP', 'CONCEPTION', 'CONNAISSANCES'],
  ORGA_MER: ['LEADERSHIP', 'ORGANISATEUR', 'CONNAISSANCES'],
  ORGA_CARRIERE: ['LEADERSHIP', 'FORMATEUR', 'ORGANISATEUR', 'CONNAISSANCES'],
  DIRECTEUR_PLONGEE: ['LEADERSHIP', 'ORGANISATEUR', 'CONNAISSANCES'],
  STAGE_FINAL: [
    'LEADERSHIP',
    'FORMATEUR',
    'ORGANISATEUR',
    'CONCEPTION',
    'CONNAISSANCES',
  ],
};

/**
 * Les 99 critères officiels mappés sur les colonnes I à DC d'Excel.
 */
export const OFFICIAL_CRITERIA: Criterion[] = [
  // 1. COURS_MF (Colonnes I à P — 8 critères)
  { id: 1, excel_col: 'I', exam_code: 'COURS_MF', pillar_code: 'LEADERSHIP', order_in_exam: 1, question_text: "Le CMN démontre-t-il la prestance attendue d'un MN ?", is_active: true },
  { id: 2, excel_col: 'J', exam_code: 'COURS_MF', pillar_code: 'LEADERSHIP', order_in_exam: 2, question_text: "Le CMN démontre-t-il ses capacités d'écoute ?", is_active: true },
  { id: 3, excel_col: 'K', exam_code: 'COURS_MF', pillar_code: 'LEADERSHIP', order_in_exam: 3, question_text: "Le CMN démontre-t-il ses capacités à gérer une audience ?", is_active: true },
  { id: 4, excel_col: 'L', exam_code: 'COURS_MF', pillar_code: 'FORMATEUR', order_in_exam: 4, question_text: "Le CMN apporte-t-il des connaissances utiles à l'auditoire ?", is_active: true },
  { id: 5, excel_col: 'M', exam_code: 'COURS_MF', pillar_code: 'FORMATEUR', order_in_exam: 5, question_text: "Le CMN a-t-il les capacités pédagogiques attendues ?", is_active: true },
  { id: 6, excel_col: 'N', exam_code: 'COURS_MF', pillar_code: 'FORMATEUR', order_in_exam: 6, question_text: "Le CMN apporte-t-il aux moniteurs les principaux outils pédagogiques nécessaires à son rôle de formateur de plongeurs ?", is_active: true },
  { id: 7, excel_col: 'O', exam_code: 'COURS_MF', pillar_code: 'CONNAISSANCES', order_in_exam: 7, question_text: "Le CMN a-t-il les connaissances théoriques pour former un moniteur ?", is_active: true },
  { id: 8, excel_col: 'P', exam_code: 'COURS_MF', pillar_code: 'CONNAISSANCES', order_in_exam: 8, question_text: "Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ?", is_active: true },

  // 2. PEDA_AM_MC (Colonnes Q à W — 7 critères)
  { id: 9, excel_col: 'Q', exam_code: 'PEDA_AM_MC', pillar_code: 'LEADERSHIP', order_in_exam: 1, question_text: "Le CMN démontre-t-il la prestance attendue d'un MN ?", is_active: true },
  { id: 10, excel_col: 'R', exam_code: 'PEDA_AM_MC', pillar_code: 'LEADERSHIP', order_in_exam: 2, question_text: "Le CMN démontre-t-il ses capacités d'écoute ?", is_active: true },
  { id: 11, excel_col: 'S', exam_code: 'PEDA_AM_MC', pillar_code: 'FORMATEUR', order_in_exam: 3, question_text: "Le CMN détecte-t-il les points à améliorer du candidat AM/MC ?", is_active: true },
  { id: 12, excel_col: 'T', exam_code: 'PEDA_AM_MC', pillar_code: 'FORMATEUR', order_in_exam: 4, question_text: "Les remarques formulées par le CMN sont-elles pertinentes ?", is_active: true },
  { id: 13, excel_col: 'U', exam_code: 'PEDA_AM_MC', pillar_code: 'FORMATEUR', order_in_exam: 5, question_text: "Le CMN apporte-t-il des conseils utiles pour faire progresser le candidat AM/MC ?", is_active: true },
  { id: 14, excel_col: 'V', exam_code: 'PEDA_AM_MC', pillar_code: 'FORMATEUR', order_in_exam: 6, question_text: "Le CMN a-t-il les capacités pédagogiques attendues pour former et évaluer la prestation ?", is_active: true },
  { id: 15, excel_col: 'W', exam_code: 'PEDA_AM_MC', pillar_code: 'CONNAISSANCES', order_in_exam: 7, question_text: "Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ?", is_active: true },

  // 3. FORMATION_MF_REG (Colonnes X à AH — 11 critères)
  { id: 16, excel_col: 'X', exam_code: 'FORMATION_MF_REG', pillar_code: 'LEADERSHIP', order_in_exam: 1, question_text: "Le CMN démontre-t-il la prestance attendue d'un MN ?", is_active: true },
  { id: 17, excel_col: 'Y', exam_code: 'FORMATION_MF_REG', pillar_code: 'LEADERSHIP', order_in_exam: 2, question_text: "Le CMN démontre-t-il ses capacités d'écoute ?", is_active: true },
  { id: 18, excel_col: 'Z', exam_code: 'FORMATION_MF_REG', pillar_code: 'LEADERSHIP', order_in_exam: 3, question_text: "Le CMN a-t-il la capacité de prendre des décisions et de les justifier ?", is_active: true },
  { id: 19, excel_col: 'AA', exam_code: 'FORMATION_MF_REG', pillar_code: 'FORMATEUR', order_in_exam: 4, question_text: "Le CMN a-t-il les capacités à détecter les points à améliorer d'un moniteur ?", is_active: true },
  { id: 20, excel_col: 'AB', exam_code: 'FORMATION_MF_REG', pillar_code: 'FORMATEUR', order_in_exam: 5, question_text: "Le CMN apporte-t-il des conseils pertinents pour faire progresser les moniteurs ?", is_active: true },
  { id: 21, excel_col: 'AC', exam_code: 'FORMATION_MF_REG', pillar_code: 'FORMATEUR', order_in_exam: 6, question_text: "Le CMN apporte-t-il les conseils judicieux pour qu'un moniteur forme des plongeurs ?", is_active: true },
  { id: 22, excel_col: 'AD', exam_code: 'FORMATION_MF_REG', pillar_code: 'FORMATEUR', order_in_exam: 7, question_text: "Le CMN a-t-il les capacités pédagogiques ?", is_active: true },
  { id: 23, excel_col: 'AE', exam_code: 'FORMATION_MF_REG', pillar_code: 'FORMATEUR', order_in_exam: 8, question_text: "Le CMN apporte-t-il au moniteur les principaux outils pédagogiques nécessaires à son rôle de formateur de plongeurs ?", is_active: true },
  { id: 24, excel_col: 'AF', exam_code: 'FORMATION_MF_REG', pillar_code: 'FORMATEUR', order_in_exam: 9, question_text: "Le CMN réalise-t-il des démonstrations ?", is_active: true },
  { id: 25, excel_col: 'AG', exam_code: 'FORMATION_MF_REG', pillar_code: 'CONNAISSANCES', order_in_exam: 10, question_text: "Le CMN a-t-il les connaissances théoriques et/ou compétences techniques pour former un CMF ?", is_active: true },
  { id: 26, excel_col: 'AH', exam_code: 'FORMATION_MF_REG', pillar_code: 'CONNAISSANCES', order_in_exam: 11, question_text: "Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ?", is_active: true },

  // 4. STAGE_EXPERIENCE (Colonnes AI à AQ — 9 critères)
  { id: 27, excel_col: 'AI', exam_code: 'STAGE_EXPERIENCE', pillar_code: 'LEADERSHIP', order_in_exam: 1, question_text: "Le CMN démontre-t-il la prestance attendue d'un MN ?", is_active: true },
  { id: 28, excel_col: 'AJ', exam_code: 'STAGE_EXPERIENCE', pillar_code: 'LEADERSHIP', order_in_exam: 2, question_text: "Le CMN a-t-il la capacité de prendre des décisions et de les justifier ?", is_active: true },
  { id: 29, excel_col: 'AK', exam_code: 'STAGE_EXPERIENCE', pillar_code: 'LEADERSHIP', order_in_exam: 3, question_text: "Le CMN démontre-t-il ses capacités à diriger un groupe important de plongeurs et de moniteurs ?", is_active: true },
  { id: 30, excel_col: 'AL', exam_code: 'STAGE_EXPERIENCE', pillar_code: 'ORGANISATEUR', order_in_exam: 4, question_text: "Les briefings du CMN sont-ils clairs, compréhensibles et complets ?", is_active: true },
  { id: 31, excel_col: 'AM', exam_code: 'STAGE_EXPERIENCE', pillar_code: 'ORGANISATEUR', order_in_exam: 5, question_text: "Le CMN a-t-il les capacités à organiser la sécurité d'un évènement de grande ampleur ?", is_active: true },
  { id: 32, excel_col: 'AN', exam_code: 'STAGE_EXPERIENCE', pillar_code: 'ORGANISATEUR', order_in_exam: 6, question_text: "Le CMN a-t-il les capacités à gérer un incident (ou accident) simulé dans son organisation ?", is_active: true },
  { id: 33, excel_col: 'AO', exam_code: 'STAGE_EXPERIENCE', pillar_code: 'ORGANISATEUR', order_in_exam: 7, question_text: "À la fin de la plongée, le CMN s'inquiète-t-il des résultats des exercices et des incidents éventuels dans les palanquées ?", is_active: true },
  { id: 34, excel_col: 'AP', exam_code: 'STAGE_EXPERIENCE', pillar_code: 'CONNAISSANCES', order_in_exam: 8, question_text: "Le CMN a-t-il les connaissances théoriques et/ou compétences techniques pour former un moniteur ?", is_active: true },
  { id: 35, excel_col: 'AQ', exam_code: 'STAGE_EXPERIENCE', pillar_code: 'CONNAISSANCES', order_in_exam: 9, question_text: "Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ainsi que les règles locales ?", is_active: true },

  // 5. TRAVAIL_POLE (Colonnes AR à AW — 6 critères)
  { id: 36, excel_col: 'AR', exam_code: 'TRAVAIL_POLE', pillar_code: 'CONCEPTION', order_in_exam: 1, question_text: "Le CMN démontre-t-il ses capacités à travailler en équipe ?", is_active: true },
  { id: 37, excel_col: 'AS', exam_code: 'TRAVAIL_POLE', pillar_code: 'CONCEPTION', order_in_exam: 2, question_text: "Le CMN est-il à l'écoute des autres participants ?", is_active: true },
  { id: 38, excel_col: 'AT', exam_code: 'TRAVAIL_POLE', pillar_code: 'CONCEPTION', order_in_exam: 3, question_text: "Le CMN est-il capable de détecter des problèmes dans un processus et y apporter des solutions ?", is_active: true },
  { id: 39, excel_col: 'AU', exam_code: 'TRAVAIL_POLE', pillar_code: 'CONCEPTION', order_in_exam: 4, question_text: "Le CMN a-t-il un esprit de synthèse ?", is_active: true },
  { id: 40, excel_col: 'AV', exam_code: 'TRAVAIL_POLE', pillar_code: 'CONCEPTION', order_in_exam: 5, question_text: "À la fin de la discussion, le CMN arrive-t-il à rassembler les participants autour d'une solution acceptable par la majorité ?", is_active: true },
  { id: 41, excel_col: 'AW', exam_code: 'TRAVAIL_POLE', pillar_code: 'CONNAISSANCES', order_in_exam: 6, question_text: "Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ?", is_active: true },

  // 6. EXAMEN_THEORIQUE (Colonnes AX à AY — 2 critères)
  { id: 42, excel_col: 'AX', exam_code: 'EXAMEN_THEORIQUE', pillar_code: 'CONNAISSANCES', order_in_exam: 1, question_text: "Le CMN a-t-il les connaissances théoriques pour former un moniteur ?", is_active: true },
  { id: 43, excel_col: 'AY', exam_code: 'EXAMEN_THEORIQUE', pillar_code: 'FORMATEUR', order_in_exam: 2, question_text: "Le CMN a-t-il les capacités pédagogiques nécessaires ?", is_active: true },

  // 7. GESTION_DEBAT (Colonnes AZ à BG — 8 critères)
  { id: 44, excel_col: 'AZ', exam_code: 'GESTION_DEBAT', pillar_code: 'LEADERSHIP', order_in_exam: 1, question_text: "Le CMN démontre-t-il la prestance attendue d'un MN ?", is_active: true },
  { id: 45, excel_col: 'BA', exam_code: 'GESTION_DEBAT', pillar_code: 'LEADERSHIP', order_in_exam: 2, question_text: "Le CMN est-il à l'écoute ?", is_active: true },
  { id: 46, excel_col: 'BB', exam_code: 'GESTION_DEBAT', pillar_code: 'LEADERSHIP', order_in_exam: 3, question_text: "Le CMN démontre-t-il ses capacités à diriger un groupe important de moniteurs ?", is_active: true },
  { id: 47, excel_col: 'BC', exam_code: 'GESTION_DEBAT', pillar_code: 'CONCEPTION', order_in_exam: 4, question_text: "Le CMN démontre-t-il des capacités à travailler en équipe ?", is_active: true },
  { id: 48, excel_col: 'BD', exam_code: 'GESTION_DEBAT', pillar_code: 'CONCEPTION', order_in_exam: 5, question_text: "Le CMN est-il capable de détecter des problèmes dans un processus et d'y apporter des solutions ?", is_active: true },
  { id: 49, excel_col: 'BE', exam_code: 'GESTION_DEBAT', pillar_code: 'CONCEPTION', order_in_exam: 6, question_text: "Le CMN a-t-il un esprit de synthèse ?", is_active: true },
  { id: 50, excel_col: 'BF', exam_code: 'GESTION_DEBAT', pillar_code: 'CONCEPTION', order_in_exam: 7, question_text: "À la fin de la discussion, le CMN propose-t-il une solution acceptable par la majorité des membres ?", is_active: true },
  { id: 51, excel_col: 'BG', exam_code: 'GESTION_DEBAT', pillar_code: 'CONNAISSANCES', order_in_exam: 8, question_text: "Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ?", is_active: true },

  // 8. ORGA_MER (Colonnes BH à BP — 9 critères)
  { id: 52, excel_col: 'BH', exam_code: 'ORGA_MER', pillar_code: 'LEADERSHIP', order_in_exam: 1, question_text: "Le CMN démontre-t-il la prestance attendue d'un MN ?", is_active: true },
  { id: 53, excel_col: 'BI', exam_code: 'ORGA_MER', pillar_code: 'LEADERSHIP', order_in_exam: 2, question_text: "Le CMN est-il à l'écoute ?", is_active: true },
  { id: 54, excel_col: 'BJ', exam_code: 'ORGA_MER', pillar_code: 'LEADERSHIP', order_in_exam: 3, question_text: "Le CMN a-t-il la capacité à prendre des décisions et à les justifier ?", is_active: true },
  { id: 55, excel_col: 'BK', exam_code: 'ORGA_MER', pillar_code: 'LEADERSHIP', order_in_exam: 4, question_text: "Le CMN démontre-t-il ses capacités à gérer une audience ?", is_active: true },
  { id: 56, excel_col: 'BL', exam_code: 'ORGA_MER', pillar_code: 'ORGANISATEUR', order_in_exam: 5, question_text: "Le CMN a-t-il les capacités à organiser un évènement de grande ampleur ?", is_active: true },
  { id: 57, excel_col: 'BM', exam_code: 'ORGA_MER', pillar_code: 'ORGANISATEUR', order_in_exam: 6, question_text: "Les briefings du CMN sont-ils clairs, compréhensibles et complets ?", is_active: true },
  { id: 58, excel_col: 'BN', exam_code: 'ORGA_MER', pillar_code: 'ORGANISATEUR', order_in_exam: 7, question_text: "Le CMN a-t-il les capacités à organiser la sécurité d'un évènement ?", is_active: true },
  { id: 59, excel_col: 'BO', exam_code: 'ORGA_MER', pillar_code: 'ORGANISATEUR', order_in_exam: 8, question_text: "Le CMN a-t-il les capacités à gérer un incident (ou accident) simulé dans son organisation ?", is_active: true },
  { id: 60, excel_col: 'BP', exam_code: 'ORGA_MER', pillar_code: 'CONNAISSANCES', order_in_exam: 9, question_text: "Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ainsi que les règles locales ?", is_active: true },

  // 9. ORGA_CARRIERE (Colonnes BQ à CB — 12 critères)
  { id: 61, excel_col: 'BQ', exam_code: 'ORGA_CARRIERE', pillar_code: 'LEADERSHIP', order_in_exam: 1, question_text: "Le CMN démontre-t-il la prestance attendue d'un MN ?", is_active: true },
  { id: 62, excel_col: 'BR', exam_code: 'ORGA_CARRIERE', pillar_code: 'LEADERSHIP', order_in_exam: 2, question_text: "Le CMN est-il à l'écoute ?", is_active: true },
  { id: 63, excel_col: 'BS', exam_code: 'ORGA_CARRIERE', pillar_code: 'LEADERSHIP', order_in_exam: 3, question_text: "Le CMN a-t-il la capacité à prendre des décisions et à les justifier ?", is_active: true },
  { id: 64, excel_col: 'BT', exam_code: 'ORGA_CARRIERE', pillar_code: 'LEADERSHIP', order_in_exam: 4, question_text: "Le CMN démontre-t-il ses capacités à diriger un groupe important de plongeurs et de moniteurs ?", is_active: true },
  { id: 65, excel_col: 'BU', exam_code: 'ORGA_CARRIERE', pillar_code: 'FORMATEUR', order_in_exam: 5, question_text: "Le CMN apporte-t-il des conseils pertinents pour faire progresser les plongeurs et les moniteurs ?", is_active: true },
  { id: 66, excel_col: 'BV', exam_code: 'ORGA_CARRIERE', pillar_code: 'FORMATEUR', order_in_exam: 6, question_text: "Le CMN a-t-il les capacités pédagogiques nécessaires à l'organisation d'une sortie de haut niveau ?", is_active: true },
  { id: 67, excel_col: 'BW', exam_code: 'ORGA_CARRIERE', pillar_code: 'ORGANISATEUR', order_in_exam: 7, question_text: "Les briefings du CMN sont-ils clairs, compréhensibles et complets ?", is_active: true },
  { id: 68, excel_col: 'BX', exam_code: 'ORGA_CARRIERE', pillar_code: 'ORGANISATEUR', order_in_exam: 8, question_text: "Le CMN a-t-il les capacités à organiser la sécurité d'un évènement ?", is_active: true },
  { id: 69, excel_col: 'BY', exam_code: 'ORGA_CARRIERE', pillar_code: 'ORGANISATEUR', order_in_exam: 9, question_text: "Le CMN a-t-il les capacités à gérer un incident (ou accident) simulé dans son organisation ?", is_active: true },
  { id: 70, excel_col: 'BZ', exam_code: 'ORGA_CARRIERE', pillar_code: 'ORGANISATEUR', order_in_exam: 10, question_text: "À la fin de la plongée, le CMN s'inquiète-t-il des résultats des exercices et des incidents éventuels dans les palanquées ?", is_active: true },
  { id: 71, excel_col: 'CA', exam_code: 'ORGA_CARRIERE', pillar_code: 'CONNAISSANCES', order_in_exam: 11, question_text: "Le CMN a-t-il les connaissances suffisantes théoriques et techniques en organisation ?", is_active: true },
  { id: 72, excel_col: 'CB', exam_code: 'ORGA_CARRIERE', pillar_code: 'CONNAISSANCES', order_in_exam: 12, question_text: "Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ainsi que les règles locales ?", is_active: true },

  // 10. STAGE_FINAL (Colonnes CC à DC — 27 critères)
  { id: 73, excel_col: 'CC', exam_code: 'STAGE_FINAL', pillar_code: 'LEADERSHIP', order_in_exam: 1, question_text: "Le CMN a-t-il un rayonnement ?", is_active: true },
  { id: 74, excel_col: 'CD', exam_code: 'STAGE_FINAL', pillar_code: 'LEADERSHIP', order_in_exam: 2, question_text: "Le CMN donne-t-il envie de le suivre ?", is_active: true },
  { id: 75, excel_col: 'CE', exam_code: 'STAGE_FINAL', pillar_code: 'LEADERSHIP', order_in_exam: 3, question_text: "Le CMN est-il à l'écoute des autres ?", is_active: true },
  { id: 76, excel_col: 'CF', exam_code: 'STAGE_FINAL', pillar_code: 'LEADERSHIP', order_in_exam: 4, question_text: "Le CMN a-t-il la capacité à prendre des décisions et de les justifier ?", is_active: true },
  { id: 77, excel_col: 'CG', exam_code: 'STAGE_FINAL', pillar_code: 'LEADERSHIP', order_in_exam: 5, question_text: "Le CMN démontre-t-il ses capacités à diriger un groupe important de moniteurs ?", is_active: true },
  { id: 78, excel_col: 'CH', exam_code: 'STAGE_FINAL', pillar_code: 'FORMATEUR', order_in_exam: 6, question_text: "Le CMN a-t-il les capacités à détecter les points à améliorer d'un moniteur ?", is_active: true },
  { id: 79, excel_col: 'CI', exam_code: 'STAGE_FINAL', pillar_code: 'FORMATEUR', order_in_exam: 7, question_text: "Le CMN apporte-t-il les conseils judicieux pour qu'un moniteur forme des plongeurs ?", is_active: true },
  { id: 80, excel_col: 'CJ', exam_code: 'STAGE_FINAL', pillar_code: 'FORMATEUR', order_in_exam: 8, question_text: "Le CMN a-t-il les capacités pédagogiques ?", is_active: true },
  { id: 81, excel_col: 'CK', exam_code: 'STAGE_FINAL', pillar_code: 'FORMATEUR', order_in_exam: 9, question_text: "Le CMN apporte-t-il au moniteur les principaux outils pédagogiques en vue de son rôle de formateur de plongeurs ?", is_active: true },
  { id: 82, excel_col: 'CL', exam_code: 'STAGE_FINAL', pillar_code: 'FORMATEUR', order_in_exam: 10, question_text: "Le CMN a-t-il les capacités pédagogiques ? (Volet 2)", is_active: true },
  { id: 83, excel_col: 'CM', exam_code: 'STAGE_FINAL', pillar_code: 'FORMATEUR', order_in_exam: 11, question_text: "Le CMN apporte-t-il au moniteur les principaux outils pédagogiques en vue de son rôle de formateur de plongeurs ? (Volet 2)", is_active: true },
  { id: 84, excel_col: 'CN', exam_code: 'STAGE_FINAL', pillar_code: 'FORMATEUR', order_in_exam: 12, question_text: "Le CMN réalise-t-il des démonstrations ?", is_active: true },
  { id: 85, excel_col: 'CO', exam_code: 'STAGE_FINAL', pillar_code: 'FORMATEUR', order_in_exam: 13, question_text: "Les remarques formulées par le CMN sont-elles pertinentes ?", is_active: true },
  { id: 86, excel_col: 'CP', exam_code: 'STAGE_FINAL', pillar_code: 'ORGANISATEUR', order_in_exam: 14, question_text: "Le CMN a-t-il les capacités à organiser un évènement de grande ampleur ?", is_active: true },
  { id: 87, excel_col: 'CQ', exam_code: 'STAGE_FINAL', pillar_code: 'ORGANISATEUR', order_in_exam: 15, question_text: "Le CMN a-t-il réalisé un briefing clair, compréhensible et complet ?", is_active: true },
  { id: 88, excel_col: 'CR', exam_code: 'STAGE_FINAL', pillar_code: 'ORGANISATEUR', order_in_exam: 16, question_text: "Le CMN a-t-il les capacités à organiser la sécurité d'un évènement ?", is_active: true },
  { id: 89, excel_col: 'CS', exam_code: 'STAGE_FINAL', pillar_code: 'ORGANISATEUR', order_in_exam: 17, question_text: "Le CMN a-t-il les capacités à donner un briefing aux moniteurs de son organisation en vue de leur donner les conseils et consignes qu'il attend ?", is_active: true },
  { id: 90, excel_col: 'CT', exam_code: 'STAGE_FINAL', pillar_code: 'ORGANISATEUR', order_in_exam: 18, question_text: "Le CMN a-t-il les capacités à gérer un incident (ou accident) simulé dans son organisation ?", is_active: true },
  { id: 91, excel_col: 'CU', exam_code: 'STAGE_FINAL', pillar_code: 'ORGANISATEUR', order_in_exam: 19, question_text: "À la fin de la plongée, le CMN s'inquiète-t-il des résultats des exercices et des incidents éventuels dans les palanquées ?", is_active: true },
  { id: 92, excel_col: 'CV', exam_code: 'STAGE_FINAL', pillar_code: 'CONCEPTION', order_in_exam: 20, question_text: "Le CMN démontre-t-il des capacités à travailler en équipe ?", is_active: true },
  { id: 93, excel_col: 'CW', exam_code: 'STAGE_FINAL', pillar_code: 'CONCEPTION', order_in_exam: 21, question_text: "Le CMN est-il à l'écoute des autres participants ?", is_active: true },
  { id: 94, excel_col: 'CX', exam_code: 'STAGE_FINAL', pillar_code: 'CONCEPTION', order_in_exam: 22, question_text: "Le CMN est-il capable de détecter des problèmes dans un processus et d'y apporter des solutions ?", is_active: true },
  { id: 95, excel_col: 'CY', exam_code: 'STAGE_FINAL', pillar_code: 'CONCEPTION', order_in_exam: 23, question_text: "Le CMN a-t-il un esprit de synthèse ?", is_active: true },
  { id: 96, excel_col: 'CZ', exam_code: 'STAGE_FINAL', pillar_code: 'CONCEPTION', order_in_exam: 24, question_text: "À la fin de la discussion, le CMN arrive-t-il à rassembler les participants autour d'une solution acceptable par la majorité des membres ?", is_active: true },
  { id: 97, excel_col: 'DA', exam_code: 'STAGE_FINAL', pillar_code: 'CONNAISSANCES', order_in_exam: 25, question_text: "Le CMN a-t-il les connaissances théoriques pour former un moniteur ?", is_active: true },
  { id: 98, excel_col: 'DB', exam_code: 'STAGE_FINAL', pillar_code: 'CONNAISSANCES', order_in_exam: 26, question_text: "Le CMN a-t-il les connaissances suffisantes en organisation ?", is_active: true },
  { id: 99, excel_col: 'DC', exam_code: 'STAGE_FINAL', pillar_code: 'CONNAISSANCES', order_in_exam: 27, question_text: "Le CMN a-t-il les connaissances théoriques suffisantes sur nos règles et règlements ?", is_active: true },

  // 11. DIRECTEUR_PLONGEE (Critères 100 à 107 — 8 critères opérationnels Directeur de plongée)
  { id: 100, excel_col: 'DP1', exam_code: 'DIRECTEUR_PLONGEE', pillar_code: 'LEADERSHIP', order_in_exam: 1, question_text: "Le CMN fait-il preuve d'autorité naturelle, de calme et de prestance dans son rôle de Directeur de plongée ?", is_active: true },
  { id: 101, excel_col: 'DP2', exam_code: 'DIRECTEUR_PLONGEE', pillar_code: 'LEADERSHIP', order_in_exam: 2, question_text: "Le CMN communique-t-il clairement les consignes et sait-il trancher en cas d'imprévu ou d'adaptation de plongée ?", is_active: true },
  { id: 102, excel_col: 'DP3', exam_code: 'DIRECTEUR_PLONGEE', pillar_code: 'ORGANISATEUR', order_in_exam: 3, question_text: "Le briefing général du Directeur de plongée (site, dangers, sécurité, paramètres) est-il structuré et complet ?", is_active: true },
  { id: 103, excel_col: 'DP4', exam_code: 'DIRECTEUR_PLONGEE', pillar_code: 'ORGANISATEUR', order_in_exam: 4, question_text: "La composition des palanquées et la tenue de la feuille de sécurité (heures, profondeurs, gaz) sont-elles rigoureuses ?", is_active: true },
  { id: 104, excel_col: 'DP5', exam_code: 'DIRECTEUR_PLONGEE', pillar_code: 'ORGANISATEUR', order_in_exam: 5, question_text: "Le dispositif de sécurité surface (oxygène, trousse de secours, moyens d'alerte, bloc de secours) est-il vérifié et opérationnel ?", is_active: true },
  { id: 105, excel_col: 'DP6', exam_code: 'DIRECTEUR_PLONGEE', pillar_code: 'ORGANISATEUR', order_in_exam: 6, question_text: "À la sortie de l'eau, le Directeur de plongée contrôle-t-il systématiquement les paramètres réalisés et l'état des plongeurs ?", is_active: true },
  { id: 106, excel_col: 'DP7', exam_code: 'DIRECTEUR_PLONGEE', pillar_code: 'CONNAISSANCES', order_in_exam: 7, question_text: "Le CMN maîtrise-t-il les prérogatives LIFRAS, les règles de décompression et les procédures d'urgence en tant que DP ?", is_active: true },
  { id: 107, excel_col: 'DP8', exam_code: 'DIRECTEUR_PLONGEE', pillar_code: 'CONNAISSANCES', order_in_exam: 8, question_text: "Le CMN connaît-il parfaitement les règlements particuliers du site de plongée et les obligations légales du DP ?", is_active: true },
];
