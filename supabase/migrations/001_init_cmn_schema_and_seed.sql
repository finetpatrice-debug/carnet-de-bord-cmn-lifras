-- ============================================================================
-- MIGRATION 001 : SCHEMA RELATIONNEL CMN, SECURITE RLS & SEED DES 99 CRITERES
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Cohortes / Promotions annuelles
CREATE TABLE cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  scoring_mode TEXT NOT NULL DEFAULT 'ISO_EXCEL' CHECK (scoring_mode IN ('ISO_EXCEL', 'WEIGHTED')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Profils utilisateurs et Fiche Signalétique complète (cf. feuille Informations personnelles)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN_DTF', 'MN_EVALUATOR', 'PARRAIN_MN', 'CMN_CANDIDATE')),
  cohort_id UUID REFERENCES cohorts(id),
  sponsor_mn_id UUID REFERENCES profiles(id),
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  birth_date DATE,
  street_address TEXT,
  postal_code TEXT,
  city TEXT,
  phone_landline TEXT,
  phone_gsm TEXT,
  email TEXT UNIQUE NOT NULL,
  febras_number TEXT UNIQUE,
  cfps_year SMALLINT CHECK (cfps_year IS NULL OR (cfps_year >= 1950 AND cfps_year <= 2100)),
  mf_year SMALLINT CHECK (mf_year IS NULL OR (mf_year >= 1950 AND mf_year <= 2100)),
  dives_count INT CHECK (dives_count IS NULL OR dives_count >= 0),
  club_name TEXT,
  club_president TEXT,
  club_head_instructor TEXT,
  club_head_gsm TEXT,
  photo_storage_path TEXT,
  aliases TEXT[] DEFAULT '{}', -- Pour dédoublonner les noms lors de l'import Excel
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Les 5 Piliers de compétences du Moniteur National
CREATE TABLE pillars (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  official_description TEXT NOT NULL,
  display_order SMALLINT NOT NULL
);

-- 4. Les 10 Épreuves réglementaires du cursus CMN
CREATE TABLE exam_types (
  code TEXT PRIMARY KEY,
  short_title TEXT NOT NULL,
  forms_label TEXT UNIQUE NOT NULL, -- Libellé exact de la colonne H dans l'export Forms/Excel
  display_order SMALLINT NOT NULL
);

-- 5. Les 99 Critères d'évaluation mappés sur les colonnes I à DC d'Excel
CREATE TABLE criteria (
  id INT PRIMARY KEY,
  excel_col TEXT UNIQUE NOT NULL,
  exam_code TEXT NOT NULL REFERENCES exam_types(code) ON DELETE RESTRICT,
  pillar_code TEXT NOT NULL REFERENCES pillars(code) ON DELETE RESTRICT,
  order_in_exam SMALLINT NOT NULL,
  question_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. Prestations évaluées
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_row_id INT,
  candidate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  exam_code TEXT NOT NULL REFERENCES exam_types(code) ON DELETE RESTRICT,
  lead_evaluator_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  legacy_evaluator_raw TEXT, -- Conservé si import historique avant résolution d'identité
  event_date DATE NOT NULL,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  improvements_comment TEXT NOT NULL DEFAULT '', -- Colonne DD : Ce que le CMN doit améliorer
  strengths_comment TEXT NOT NULL DEFAULT '',    -- Colonne DE : Ce que le CMN doit garder
  status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Co-examinateurs (jurys multiples normalisés)
CREATE TABLE evaluation_evaluators (
  evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  PRIMARY KEY (evaluation_id, evaluator_id)
);

-- 8. Cotations unitaires par critère
CREATE TABLE evaluation_scores (
  evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  criterion_id INT NOT NULL REFERENCES criteria(id) ON DELETE RESTRICT,
  grade TEXT NOT NULL CHECK (grade IN ('TB', 'B', 'S', 'I', 'M', 'NE')),
  PRIMARY KEY (evaluation_id, criterion_id)
);

-- 9. Journal d'audit immuable (reclassement d'épreuve, correction administrative)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activation RLS
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_evaluators ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Lecture publique authentifiée des référentiels
CREATE POLICY "Read referentials" ON pillars FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read exam_types" ON exam_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read criteria" ON criteria FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read cohorts" ON cohorts FOR SELECT TO authenticated USING (true);

-- Politiques de sécurité sur les évaluations
CREATE POLICY "CMN reads own evaluations" ON evaluations FOR SELECT TO authenticated
  USING (
    candidate_id = auth.uid()
    OR lead_evaluator_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN_DTF')
    OR EXISTS (SELECT 1 FROM profiles c WHERE c.id = evaluations.candidate_id AND c.sponsor_mn_id = auth.uid())
  );

CREATE POLICY "MN inserts evaluations" ON evaluations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('MN_EVALUATOR', 'ADMIN_DTF'))
  );

CREATE POLICY "Admin updates evaluations" ON evaluations FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN_DTF')
    OR (lead_evaluator_id = auth.uid() AND created_at > now() - INTERVAL '24 hours')
  );

-- ============================================================================
-- DONNEES INITIALES : COHORTE, 5 PILIERS, 10 EPREUVES ET 99 CRITERES OFFICIELS
-- ============================================================================

INSERT INTO cohorts (code, label, scoring_mode) VALUES
  ('CMN_2026', 'Cursus Candidats Moniteurs Nationaux 2026', 'ISO_EXCEL');

INSERT INTO pillars (code, title, official_description, display_order) VALUES
  ('LEADERSHIP', 'Leadership', 'Grâce aux compétences et connaissances maîtrisées, le Moniteur National est un leader qui guide et inspire naturellement les plongeurs et les moniteurs qu''il côtoie, tout en consacrant du temps à la Commission de l''Enseignement.', 1),
  ('FORMATEUR', 'Formateur d''instructeurs', 'Le Moniteur National forme et évalue les instructeurs de plongée. Il est capable d''aider tout moniteur à se perfectionner à tous les niveaux et notamment en pédagogie.', 2),
  ('CONCEPTION', 'Capacité de conception en groupe', 'Le Moniteur National possède un esprit d''analyse, un esprit critique, de la créativité et la capacité de travailler en équipe pour faire évoluer l''enseignement et les règles de la plongée au sein de la ligue.', 3),
  ('CONNAISSANCES', 'Connaissances théoriques', 'Étant le plus haut brevet de moniteur de la ligue, le Moniteur National possède des connaissances théoriques et pratiques étendues (médecine, urgence, organisation, mer, lois et réglementations) et constitue une référence fiable.', 4),
  ('ORGANISATEUR', 'Organisateur', 'Le Moniteur National possède les connaissances et l''expérience nécessaires à l''organisation efficace de tous types d''activités de plongée de grande ampleur (composition des palanquées, sécurité, briefings, gestion d''incident).', 5);

INSERT INTO exam_types (code, short_title, forms_label, display_order) VALUES
  ('COURS_MF', 'Cours CMF', 'Cours niveau MF', 1),
  ('PEDA_AM_MC', 'Pédagogie AM-MC', 'Pédagogie AM ou MC', 2),
  ('FORMATION_MF_REG', 'Formation MF (Ass. Rég.)', 'Formation d''un MF (dans une association régionale)', 3),
  ('STAGE_EXPERIENCE', 'Stage d''expérience', 'Stage d''expérience', 4),
  ('TRAVAIL_POLE', 'Travail dans un pôle', 'Travail pour la commission de l''enseignement (dans un pôle par exemple)', 5),
  ('EXAMEN_THEORIQUE', 'Examen théorique', 'Examen théorique', 6),
  ('GESTION_DEBAT', 'Gestion de débat', 'Gestion d''un débat', 7),
  ('ORGA_MER', 'Organisation Mer', 'Examen organisation mer', 8),
  ('ORGA_CARRIERE', 'Organisation Carrière', 'Examen organisation carrière', 9),
  ('STAGE_FINAL', 'Stage Final', 'Stage final', 10);

INSERT INTO criteria (id, excel_col, exam_code, pillar_code, order_in_exam, question_text) VALUES
  -- 1. COURS_MF (Colonnes I à P — 8 critères)
  (1, 'I', 'COURS_MF', 'LEADERSHIP', 1, 'Le CMN démontre-t-il la prestance attendue d''un MN ?'),
  (2, 'J', 'COURS_MF', 'LEADERSHIP', 2, 'Le CMN démontre-t-il ses capacités d''écoute ?'),
  (3, 'K', 'COURS_MF', 'LEADERSHIP', 3, 'Le CMN démontre-t-il ses capacités à gérer une audience ?'),
  (4, 'L', 'COURS_MF', 'FORMATEUR', 4, 'Le CMN apporte-t-il des connaissances utiles à l''auditoire ?'),
  (5, 'M', 'COURS_MF', 'FORMATEUR', 5, 'Le CMN a-t-il les capacités pédagogiques attendues ?'),
  (6, 'N', 'COURS_MF', 'FORMATEUR', 6, 'Le CMN apporte-t-il aux moniteurs les principaux outils pédagogiques nécessaires à son rôle de formateur de plongeurs ?'),
  (7, 'O', 'COURS_MF', 'CONNAISSANCES', 7, 'Le CMN a-t-il les connaissances théoriques pour former un moniteur ?'),
  (8, 'P', 'COURS_MF', 'CONNAISSANCES', 8, 'Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ?'),
  -- 2. PEDA_AM_MC (Colonnes Q à W — 7 critères)
  (9, 'Q', 'PEDA_AM_MC', 'LEADERSHIP', 1, 'Le CMN démontre-t-il la prestance attendue d''un MN ?'),
  (10, 'R', 'PEDA_AM_MC', 'LEADERSHIP', 2, 'Le CMN démontre-t-il ses capacités d''écoute ?'),
  (11, 'S', 'PEDA_AM_MC', 'FORMATEUR', 3, 'Le CMN détecte-t-il les points à améliorer du candidat AM/MC ?'),
  (12, 'T', 'PEDA_AM_MC', 'FORMATEUR', 4, 'Les remarques formulées par le CMN sont-elles pertinentes ?'),
  (13, 'U', 'PEDA_AM_MC', 'FORMATEUR', 5, 'Le CMN apporte-t-il des conseils utiles pour faire progresser le candidat AM/MC ?'),
  (14, 'V', 'PEDA_AM_MC', 'FORMATEUR', 6, 'Le CMN a-t-il les capacités pédagogiques attendues pour former et évaluer la prestation ?'),
  (15, 'W', 'PEDA_AM_MC', 'CONNAISSANCES', 7, 'Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ?'),
  -- 3. FORMATION_MF_REG (Colonnes X à AH — 11 critères)
  (16, 'X', 'FORMATION_MF_REG', 'LEADERSHIP', 1, 'Le CMN démontre-t-il la prestance attendue d''un MN ?'),
  (17, 'Y', 'FORMATION_MF_REG', 'LEADERSHIP', 2, 'Le CMN démontre-t-il ses capacités d''écoute ?'),
  (18, 'Z', 'FORMATION_MF_REG', 'LEADERSHIP', 3, 'Le CMN a-t-il la capacité de prendre des décisions et de les justifier ?'),
  (19, 'AA', 'FORMATION_MF_REG', 'FORMATEUR', 4, 'Le CMN a-t-il les capacités à détecter les points à améliorer d''un moniteur ?'),
  (20, 'AB', 'FORMATION_MF_REG', 'FORMATEUR', 5, 'Le CMN apporte-t-il des conseils pertinents pour faire progresser les moniteurs ?'),
  (21, 'AC', 'FORMATION_MF_REG', 'FORMATEUR', 6, 'Le CMN apporte-t-il les conseils judicieux pour qu''un moniteur forme des plongeurs ?'),
  (22, 'AD', 'FORMATION_MF_REG', 'FORMATEUR', 7, 'Le CMN a-t-il les capacités pédagogiques ?'),
  (23, 'AE', 'FORMATION_MF_REG', 'FORMATEUR', 8, 'Le CMN apporte-t-il au moniteur les principaux outils pédagogiques nécessaires à son rôle de formateur de plongeurs ?'),
  (24, 'AF', 'FORMATION_MF_REG', 'FORMATEUR', 9, 'Le CMN réalise-t-il des démonstrations ?'),
  (25, 'AG', 'FORMATION_MF_REG', 'CONNAISSANCES', 10, 'Le CMN a-t-il les connaissances théoriques et/ou compétences techniques pour former un CMF ?'),
  (26, 'AH', 'FORMATION_MF_REG', 'CONNAISSANCES', 11, 'Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ?'),
  -- 4. STAGE_EXPERIENCE (Colonnes AI à AQ — 9 critères)
  (27, 'AI', 'STAGE_EXPERIENCE', 'LEADERSHIP', 1, 'Le CMN démontre-t-il la prestance attendue d''un MN ?'),
  (28, 'AJ', 'STAGE_EXPERIENCE', 'LEADERSHIP', 2, 'Le CMN a-t-il la capacité de prendre des décisions et de les justifier ?'),
  (29, 'AK', 'STAGE_EXPERIENCE', 'LEADERSHIP', 3, 'Le CMN démontre-t-il ses capacités à diriger un groupe important de plongeurs et de moniteurs ?'),
  (30, 'AL', 'STAGE_EXPERIENCE', 'ORGANISATEUR', 4, 'Les briefings du CMN sont-ils clairs, compréhensibles et complets ?'),
  (31, 'AM', 'STAGE_EXPERIENCE', 'ORGANISATEUR', 5, 'Le CMN a-t-il les capacités à organiser la sécurité d''un évènement de grande ampleur ?'),
  (32, 'AN', 'STAGE_EXPERIENCE', 'ORGANISATEUR', 6, 'Le CMN a-t-il les capacités à gérer un incident (ou accident) simulé dans son organisation ?'),
  (33, 'AO', 'STAGE_EXPERIENCE', 'ORGANISATEUR', 7, 'À la fin de la plongée, le CMN s''inquiète-t-il des résultats des exercices et des incidents éventuels dans les palanquées ?'),
  (34, 'AP', 'STAGE_EXPERIENCE', 'CONNAISSANCES', 8, 'Le CMN a-t-il les connaissances théoriques et/ou compétences techniques pour former un moniteur ?'),
  (35, 'AQ', 'STAGE_EXPERIENCE', 'CONNAISSANCES', 9, 'Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ainsi que les règles locales ?'),
  -- 5. TRAVAIL_POLE (Colonnes AR à AW — 6 critères)
  (36, 'AR', 'TRAVAIL_POLE', 'CONCEPTION', 1, 'Le CMN démontre-t-il ses capacités à travailler en équipe ?'),
  (37, 'AS', 'TRAVAIL_POLE', 'CONCEPTION', 2, 'Le CMN est-il à l''écoute des autres participants ?'),
  (38, 'AT', 'TRAVAIL_POLE', 'CONCEPTION', 3, 'Le CMN est-il capable de détecter des problèmes dans un processus et y apporter des solutions ?'),
  (39, 'AU', 'TRAVAIL_POLE', 'CONCEPTION', 4, 'Le CMN a-t-il un esprit de synthèse ?'),
  (40, 'AV', 'TRAVAIL_POLE', 'CONCEPTION', 5, 'À la fin de la discussion, le CMN arrive-t-il à rassembler les participants autour d''une solution acceptable par la majorité ?'),
  (41, 'AW', 'TRAVAIL_POLE', 'CONNAISSANCES', 6, 'Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ?'),
  -- 6. EXAMEN_THEORIQUE (Colonnes AX à AY — 2 critères)
  (42, 'AX', 'EXAMEN_THEORIQUE', 'CONNAISSANCES', 1, 'Le CMN a-t-il les connaissances théoriques pour former un moniteur ?'),
  (43, 'AY', 'EXAMEN_THEORIQUE', 'FORMATEUR', 2, 'Le CMN a-t-il les capacités pédagogiques nécessaires ?'),
  -- 7. GESTION_DEBAT (Colonnes AZ à BG — 8 critères)
  (44, 'AZ', 'GESTION_DEBAT', 'LEADERSHIP', 1, 'Le CMN démontre-t-il la prestance attendue d''un MN ?'),
  (45, 'BA', 'GESTION_DEBAT', 'LEADERSHIP', 2, 'Le CMN est-il à l''écoute ?'),
  (46, 'BB', 'GESTION_DEBAT', 'LEADERSHIP', 3, 'Le CMN démontre-t-il ses capacités à diriger un groupe important de moniteurs ?'),
  (47, 'BC', 'GESTION_DEBAT', 'CONCEPTION', 4, 'Le CMN démontre-t-il des capacités à travailler en équipe ?'),
  (48, 'BD', 'GESTION_DEBAT', 'CONCEPTION', 5, 'Le CMN est-il capable de détecter des problèmes dans un processus et d''y apporter des solutions ?'),
  (49, 'BE', 'GESTION_DEBAT', 'CONCEPTION', 6, 'Le CMN a-t-il un esprit de synthèse ?'),
  (50, 'BF', 'GESTION_DEBAT', 'CONCEPTION', 7, 'À la fin de la discussion, le CMN propose-t-il une solution acceptable par la majorité des membres ?'),
  (51, 'BG', 'GESTION_DEBAT', 'CONNAISSANCES', 8, 'Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ?'),
  -- 8. ORGA_MER (Colonnes BH à BP — 9 critères)
  (52, 'BH', 'ORGA_MER', 'LEADERSHIP', 1, 'Le CMN démontre-t-il la prestance attendue d''un MN ?'),
  (53, 'BI', 'ORGA_MER', 'LEADERSHIP', 2, 'Le CMN est-il à l''écoute ?'),
  (54, 'BJ', 'ORGA_MER', 'LEADERSHIP', 3, 'Le CMN a-t-il la capacité à prendre des décisions et à les justifier ?'),
  (55, 'BK', 'ORGA_MER', 'LEADERSHIP', 4, 'Le CMN démontre-t-il ses capacités à gérer une audience ?'),
  (56, 'BL', 'ORGA_MER', 'ORGANISATEUR', 5, 'Le CMN a-t-il les capacités à organiser un évènement de grande ampleur ?'),
  (57, 'BM', 'ORGA_MER', 'ORGANISATEUR', 6, 'Les briefings du CMN sont-ils clairs, compréhensibles et complets ?'),
  (58, 'BN', 'ORGA_MER', 'ORGANISATEUR', 7, 'Le CMN a-t-il les capacités à organiser la sécurité d''un évènement ?'),
  (59, 'BO', 'ORGA_MER', 'ORGANISATEUR', 8, 'Le CMN a-t-il les capacités à gérer un incident (ou accident) simulé dans son organisation ?'),
  (60, 'BP', 'ORGA_MER', 'CONNAISSANCES', 9, 'Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ainsi que les règles locales ?'),
  -- 9. ORGA_CARRIERE (Colonnes BQ à CB — 12 critères)
  (61, 'BQ', 'ORGA_CARRIERE', 'LEADERSHIP', 1, 'Le CMN démontre-t-il la prestance attendue d''un MN ?'),
  (62, 'BR', 'ORGA_CARRIERE', 'LEADERSHIP', 2, 'Le CMN est-il à l''écoute ?'),
  (63, 'BS', 'ORGA_CARRIERE', 'LEADERSHIP', 3, 'Le CMN a-t-il la capacité à prendre des décisions et à les justifier ?'),
  (64, 'BT', 'ORGA_CARRIERE', 'LEADERSHIP', 4, 'Le CMN démontre-t-il ses capacités à diriger un groupe important de plongeurs et de moniteurs ?'),
  (65, 'BU', 'ORGA_CARRIERE', 'FORMATEUR', 5, 'Le CMN apporte-t-il des conseils pertinents pour faire progresser les plongeurs et les moniteurs ?'),
  (66, 'BV', 'ORGA_CARRIERE', 'FORMATEUR', 6, 'Le CMN a-t-il les capacités pédagogiques nécessaires à l''organisation d''une sortie de haut niveau ?'),
  (67, 'BW', 'ORGA_CARRIERE', 'ORGANISATEUR', 7, 'Les briefings du CMN sont-ils clairs, compréhensibles et complets ?'),
  (68, 'BX', 'ORGA_CARRIERE', 'ORGANISATEUR', 8, 'Le CMN a-t-il les capacités à organiser la sécurité d''un évènement ?'),
  (69, 'BY', 'ORGA_CARRIERE', 'ORGANISATEUR', 9, 'Le CMN a-t-il les capacités à gérer un incident (ou accident) simulé dans son organisation ?'),
  (70, 'BZ', 'ORGA_CARRIERE', 'ORGANISATEUR', 10, 'À la fin de la plongée, le CMN s''inquiète-t-il des résultats des exercices et des incidents éventuels dans les palanquées ?'),
  (71, 'CA', 'ORGA_CARRIERE', 'CONNAISSANCES', 11, 'Le CMN a-t-il les connaissances suffisantes théoriques et techniques en organisation ?'),
  (72, 'CB', 'ORGA_CARRIERE', 'CONNAISSANCES', 12, 'Le CMN maîtrise-t-il les connaissances théoriques sur nos protocoles et règlements ainsi que les règles locales ?'),
  -- 10. STAGE_FINAL (Colonnes CC à DC — 27 critères)
  (73, 'CC', 'STAGE_FINAL', 'LEADERSHIP', 1, 'Le CMN a-t-il un rayonnement ?'),
  (74, 'CD', 'STAGE_FINAL', 'LEADERSHIP', 2, 'Le CMN donne-t-il envie de le suivre ?'),
  (75, 'CE', 'STAGE_FINAL', 'LEADERSHIP', 3, 'Le CMN est-il à l''écoute des autres ?'),
  (76, 'CF', 'STAGE_FINAL', 'LEADERSHIP', 4, 'Le CMN a-t-il la capacité à prendre des décisions et de les justifier ?'),
  (77, 'CG', 'STAGE_FINAL', 'LEADERSHIP', 5, 'Le CMN démontre-t-il ses capacités à diriger un groupe important de moniteurs ?'),
  (78, 'CH', 'STAGE_FINAL', 'FORMATEUR', 6, 'Le CMN a-t-il les capacités à détecter les points à améliorer d''un moniteur ?'),
  (79, 'CI', 'STAGE_FINAL', 'FORMATEUR', 7, 'Le CMN apporte-t-il les conseils judicieux pour qu''un moniteur forme des plongeurs ?'),
  (80, 'CJ', 'STAGE_FINAL', 'FORMATEUR', 8, 'Le CMN a-t-il les capacités pédagogiques ?'),
  (81, 'CK', 'STAGE_FINAL', 'FORMATEUR', 9, 'Le CMN apporte-t-il au moniteur les principaux outils pédagogiques en vue de son rôle de formateur de plongeurs ?'),
  (82, 'CL', 'STAGE_FINAL', 'FORMATEUR', 10, 'Le CMN a-t-il les capacités pédagogiques ? (Volet 2)'),
  (83, 'CM', 'STAGE_FINAL', 'FORMATEUR', 11, 'Le CMN apporte-t-il au moniteur les principaux outils pédagogiques en vue de son rôle de formateur de plongeurs ? (Volet 2)'),
  (84, 'CN', 'STAGE_FINAL', 'FORMATEUR', 12, 'Le CMN réalise-t-il des démonstrations ?'),
  (85, 'CO', 'STAGE_FINAL', 'FORMATEUR', 13, 'Les remarques formulées par le CMN sont-elles pertinentes ?'),
  (86, 'CP', 'STAGE_FINAL', 'ORGANISATEUR', 14, 'Le CMN a-t-il les capacités à organiser un évènement de grande ampleur ?'),
  (87, 'CQ', 'STAGE_FINAL', 'ORGANISATEUR', 15, 'Le CMN a-t-il réalisé un briefing clair, compréhensible et complet ?'),
  (88, 'CR', 'STAGE_FINAL', 'ORGANISATEUR', 16, 'Le CMN a-t-il les capacités à organiser la sécurité d''un évènement ?'),
  (89, 'CS', 'STAGE_FINAL', 'ORGANISATEUR', 17, 'Le CMN a-t-il les capacités à donner un briefing aux moniteurs de son organisation en vue de leur donner les conseils et consignes qu''il attend ?'),
  (90, 'CT', 'STAGE_FINAL', 'ORGANISATEUR', 18, 'Le CMN a-t-il les capacités à gérer un incident (ou accident) simulé dans son organisation ?'),
  (91, 'CU', 'STAGE_FINAL', 'ORGANISATEUR', 19, 'À la fin de la plongée, le CMN s''inquiète-t-il des résultats des exercices et des incidents éventuels dans les palanquées ?'),
  (92, 'CV', 'STAGE_FINAL', 'CONCEPTION', 20, 'Le CMN démontre-t-il des capacités à travailler en équipe ?'),
  (93, 'CW', 'STAGE_FINAL', 'CONCEPTION', 21, 'Le CMN est-il à l''écoute des autres participants ?'),
  (94, 'CX', 'STAGE_FINAL', 'CONCEPTION', 22, 'Le CMN est-il capable de détecter des problèmes dans un processus et d''y apporter des solutions ?'),
  (95, 'CY', 'STAGE_FINAL', 'CONCEPTION', 23, 'Le CMN a-t-il un esprit de synthèse ?'),
  (96, 'CZ', 'STAGE_FINAL', 'CONCEPTION', 24, 'À la fin de la discussion, le CMN arrive-t-il à rassembler les participants autour d''une solution acceptable par la majorité des membres ?'),
  (97, 'DA', 'STAGE_FINAL', 'CONNAISSANCES', 25, 'Le CMN a-t-il les connaissances théoriques pour former un moniteur ?'),
  (98, 'DB', 'STAGE_FINAL', 'CONNAISSANCES', 26, 'Le CMN a-t-il les connaissances suffisantes en organisation ?'),
  (99, 'DC', 'STAGE_FINAL', 'CONNAISSANCES', 27, 'Le CMN a-t-il les connaissances théoriques suffisantes sur nos règles et règlements ?');
