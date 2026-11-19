import * as XLSX from 'xlsx';
import type {
  Criterion,
  Evaluation,
  EvaluationScore,
  ExamCode,
  GradeCode,
  Profile,
} from '@/domain/types';
import { OFFICIAL_CRITERIA, OFFICIAL_EXAM_TYPES } from '@/domain/referentials';
import {
  computeCandidateScoreboard,
  type CandidateScoreboardResult,
} from '@/domain/scoringEngine';
import { resolveJuryCell, type JuryMatchCandidate } from './juryNormalizer';

export interface ExtractedCandidateProfile {
  last_name: string;
  first_name: string;
  birth_date: string | null;
  street_address: string | null;
  postal_code: string | null;
  city: string | null;
  phone_landline: string | null;
  phone_gsm: string | null;
  gsm_zero_restored: boolean;
  email: string;
  febras_number: string | null;
  cfps_year: number | null;
  cfps_year_warning: string | null;
  mf_year: number | null;
  dives_count: number | null;
  club_name: string | null;
  club_president: string | null;
  club_head_instructor: string | null;
}

export interface ParsedExcelEvaluationRow {
  tempId: string;
  legacy_row_id: number;
  raw_forms_label: string;
  exam_code: ExamCode | null;
  exam_recognition_warning: string | null;
  event_date: string;
  started_at: string | null;
  submitted_at: string | null;
  legacy_evaluator_raw: string;
  jury_matches: JuryMatchCandidate[];
  improvements_comment: string; // Colonne DD
  strengths_comment: string;    // Colonne DE
  scores: { criterion_id: number; excel_col: string; grade: GradeCode }[];
}

export interface ExcelWorkbookImportPreview {
  fileName: string;
  sheetNames: string[];
  candidate: ExtractedCandidateProfile;
  evaluations: ParsedExcelEvaluationRow[];
  scoreboardPreview: CandidateScoreboardResult;
  warnings: string[];
}

/**
 * Lit la valeur brute d'une cellule dans une feuille SheetJS.
 */
function readCellRaw(sheet: XLSX.WorkSheet | undefined, address: string): unknown {
  if (!sheet) return undefined;
  const cell = sheet[address] as XLSX.CellObject | undefined;
  if (!cell) return undefined;
  return cell.v ?? cell.w;
}

/**
 * Lit une cellule sous forme de chaîne nettoyée.
 */
function readCellText(sheet: XLSX.WorkSheet | undefined, address: string): string {
  const val = readCellRaw(sheet, address);
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

/**
 * Normalise un numéro GSM belge en TEXT et rétablit automatiquement le `0` initial
 * si le nombre à 9 chiffres commence par `4` (ex: 475123456 -> 0475123456).
 */
export function normalizeBelgianGsm(rawVal: unknown): {
  formatted: string | null;
  zeroRestored: boolean;
} {
  if (rawVal === undefined || rawVal === null || rawVal === '') {
    return { formatted: null, zeroRestored: false };
  }
  const rawStr = String(rawVal).trim();
  const digitsAndPlus = rawStr.replace(/[\s./-]/g, '');

  if (/^4\d{8}$/.test(digitsAndPlus)) {
    return {
      formatted: `0${digitsAndPlus}`,
      zeroRestored: true,
    };
  }

  return {
    formatted: rawStr,
    zeroRestored: false,
  };
}

/**
 * Normalise un numéro de téléphone fixe ou matricule FEBRAS en TEXT.
 */
export function normalizeTextIdentifier(rawVal: unknown): string | null {
  if (rawVal === undefined || rawVal === null || rawVal === '') {
    return null;
  }
  const str = String(rawVal).trim();
  return str.length > 0 ? str : null;
}

/**
 * Convertit une valeur de date Excel (numéro de série ou texte ou Date) en YYYY-MM-DD.
 */
export function parseExcelDateToIso(rawVal: unknown): string | null {
  if (rawVal === undefined || rawVal === null || rawVal === '') {
    return null;
  }
  if (rawVal instanceof Date && !Number.isNaN(rawVal.getTime())) {
    return rawVal.toISOString().slice(0, 10);
  }
  if (typeof rawVal === 'number') {
    const parsed = XLSX.SSF.parse_date_code(rawVal);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const yyyy = String(parsed.y).padStart(4, '0');
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  const str = String(rawVal).trim();
  // Format DD/MM/YYYY ou DD-MM-YYYY
  const dmyMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(str);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  // Format ISO YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  return null;
}

/**
 * Convertit un horodatage Excel (colonnes B et C) en ISO-8601 TIMESTAMPTZ.
 */
export function parseExcelTimestampToIso(rawVal: unknown): string | null {
  if (rawVal === undefined || rawVal === null || rawVal === '') {
    return null;
  }
  if (rawVal instanceof Date && !Number.isNaN(rawVal.getTime())) {
    return rawVal.toISOString();
  }
  if (typeof rawVal === 'number') {
    const parsed = XLSX.SSF.parse_date_code(rawVal);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const date = new Date(
        Date.UTC(
          parsed.y,
          parsed.m - 1,
          parsed.d,
          parsed.H || 0,
          parsed.M || 0,
          Math.floor(parsed.S || 0)
        )
      );
      return date.toISOString();
    }
  }
  const dIso = parseExcelDateToIso(rawVal);
  return dIso ? `${dIso}T12:00:00.000Z` : null;
}

/**
 * Normalise une valeur de cellule de cotation vers GradeCode ('TB' | 'B' | 'S' | 'I' | 'M' | 'NE').
 */
export function normalizeGradeCell(rawVal: unknown): GradeCode | null {
  if (rawVal === undefined || rawVal === null) return null;
  const cleaned = String(rawVal).trim().toUpperCase();
  if (!cleaned) return null;

  if (cleaned === 'TB' || cleaned === '10' || cleaned === 'TRÈS BIEN' || cleaned === 'TRES BIEN') {
    return 'TB';
  }
  if (cleaned === 'B' || cleaned === '8' || cleaned === 'BIEN') {
    return 'B';
  }
  if (cleaned === 'S' || cleaned === '6' || cleaned === 'SATISFAISANT' || cleaned === 'SUFFISANT') {
    return 'S';
  }
  if (cleaned === 'I' || cleaned === '4' || cleaned === '3' || cleaned === 'INSUFFISANT') {
    return 'I';
  }
  if (cleaned === 'M' || cleaned === '2' || cleaned === 'MAUVAIS' || cleaned === 'MEDIOCRE') {
    return 'M';
  }
  if (cleaned === '1') {
    return '1';
  }
  if (
    cleaned === 'NE' ||
    cleaned === 'N.E.' ||
    cleaned === 'NON ÉVALUÉ' ||
    cleaned === 'NON EVALUE' ||
    cleaned === 'N/A'
  ) {
    return 'NE';
  }

  // Prise en charge du format fractionnaire sur 20 du formulaire Examen théorique (ex: "17/20", "18/20", "15/20")
  const over20Match = /^(\d{1,2}(?:[.,]\d+)?)\s*\/\s*20$/.exec(cleaned);
  if (over20Match) {
    const val20 = Number.parseFloat(over20Match[1].replace(',', '.'));
    if (!Number.isNaN(val20)) {
      const val10 = val20 / 2;
      if (val10 >= 9) return 'TB';
      if (val10 >= 7) return 'B';
      if (val10 >= 5) return 'S';
      if (val10 >= 3) return 'I';
      if (val10 >= 1.5) return 'M';
      return '1';
    }
  }

  return null;
}

/**
 * Table de correspondance pour le format Excel MATRIX 94 colonnes (promotions CMN 2027,
 * ex: classeur de Jennyfer Verhoeven où les commentaires sont en colonnes CO et CP).
 */
const MATRIX_94_COL_TO_CRITERION_ID: Record<string, number> = {
  // 1. COURS_MF (I..P -> 1..8)
  I: 1, J: 2, K: 3, L: 4, M: 5, N: 6, O: 7, P: 8,
  // 2. PEDA_AM_MC (Q..U -> 9, 10, 12, 14, 15)
  Q: 9, R: 10, S: 12, T: 14, U: 15,
  // 3. FORMATION_MF_REG (V..AD -> 16..26)
  V: 16, W: 17, X: 18, Y: 20, Z: 22, AA: 23, AB: 24, AC: 19, AD: 26,
  // 4. STAGE_EXPERIENCE (AE..AK -> 27..35)
  AE: 27, AF: 28, AG: 29, AH: 30, AI: 31, AJ: 33, AK: 35,
  // 5. TRAVAIL_POLE (AL..AO -> 37, 38, 39, 41)
  AL: 37, AM: 38, AN: 39, AO: 41,
  // 6. EXAMEN_THEORIQUE (AQ..AR -> 42, 43)
  AQ: 42, AR: 43,
  // 7. GESTION_DEBAT (AS..AZ -> 44..51)
  AS: 44, AT: 45, AU: 46, AV: 47, AW: 48, AX: 49, AY: 50, AZ: 51,
  // 8. ORGA_MER (BA..BH -> 52..60)
  BA: 53, BB: 52, BC: 54, BD: 56, BE: 57, BF: 58, BG: 59, BH: 60,
  // 9. ORGA_CARRIERE (BI..BS -> 61..72)
  BI: 61, BJ: 62, BK: 63, BL: 64, BM: 65, BN: 66, BO: 67, BP: 68, BQ: 69, BR: 70, BS: 72,
  // 10. STAGE_FINAL (BT..CN -> 73..99)
  BT: 73, BU: 74, BV: 75, BW: 76, BX: 77, BY: 78, BZ: 79, CA: 80, CB: 81, CC: 84, CD: 85,
  CE: 87, CF: 88, CG: 89, CH: 90, CI: 92, CJ: 93, CK: 94, CL: 95, CM: 96, CN: 99,
};

/**
 * Associe le libellé de la colonne H au code d'épreuve `ExamCode` via `exam_types.forms_label`.
 */
export function matchExamCodeFromFormsLabel(rawLabel: string): ExamCode | null {
  const cleaned = rawLabel.trim().toLowerCase().replace(/’/g, "'");
  if (!cleaned) return null;

  for (const exam of OFFICIAL_EXAM_TYPES) {
    const officialNorm = exam.forms_label.toLowerCase().replace(/’/g, "'");
    const shortNorm = exam.short_title.toLowerCase().replace(/’/g, "'");
    if (cleaned === officialNorm || cleaned === shortNorm || cleaned === exam.code.toLowerCase()) {
      return exam.code;
    }
  }

  // Correspondance souple par inclusion si libellé légèrement tronqué dans Forms
  for (const exam of OFFICIAL_EXAM_TYPES) {
    const officialNorm = exam.forms_label.toLowerCase().replace(/’/g, "'");
    if (cleaned.includes(officialNorm) || officialNorm.includes(cleaned)) {
      return exam.code;
    }
  }

  return null;
}

/**
 * Extrait la fiche signalétique depuis la feuille `Informations personnelles`
 * selon les coordonnées exactes du cahier des charges :
 * D11 (Nom), G11 (Prénom), D13 (Date naissance), D16 (Adresse), D18 (Code postal),
 * G18 (Localité), D21 (Téléphone), G21 (GSM), D23 (Email), D27 (N° FEBRAS),
 * D28 (Année CFPS), G28 (Année MF), D30 (Nb plongées), D34 (Club),
 * G34 (Président), D36 (Chef d'école).
 */
export function extractCandidateProfileFromSheet(
  infoSheet: XLSX.WorkSheet | undefined
): ExtractedCandidateProfile {
  const currentYear = new Date().getFullYear();

  const lastName = readCellText(infoSheet, 'D11') || 'À compléter';
  const firstName = readCellText(infoSheet, 'G11') || 'Candidat';
  const birthDate = parseExcelDateToIso(readCellRaw(infoSheet, 'D13'));
  const streetAddress = normalizeTextIdentifier(readCellRaw(infoSheet, 'D16'));
  const postalCode = normalizeTextIdentifier(readCellRaw(infoSheet, 'D18'));
  const city = normalizeTextIdentifier(readCellRaw(infoSheet, 'G18'));

  // Lecture tolérante aux cellules fusionnées (D20/D21 pour le fixe, G20/G21/F21/H21 pour le GSM)
  const rawLandline =
    readCellRaw(infoSheet, 'D21') ??
    readCellRaw(infoSheet, 'D20') ??
    readCellRaw(infoSheet, 'E21');
  const rawGsm =
    readCellRaw(infoSheet, 'G21') ??
    readCellRaw(infoSheet, 'G20') ??
    readCellRaw(infoSheet, 'F21') ??
    readCellRaw(infoSheet, 'H21');

  let phoneLandline = normalizeTextIdentifier(rawLandline);
  let gsmResult = normalizeBelgianGsm(rawGsm);

  // Si l'utilisateur a inscrit son numéro GSM dans la case Téléphone fixe (D21) et laissé G21 vide,
  // on normalise le 0 initial et on le renseigne également dans GSM pour qu'il s'affiche partout.
  if (!gsmResult.formatted && phoneLandline) {
    const fallbackGsm = normalizeBelgianGsm(rawLandline);
    if (
      fallbackGsm.formatted &&
      (/^04\d{8}$/.test(fallbackGsm.formatted.replace(/[\s./-]/g, '')) ||
        fallbackGsm.zeroRestored)
    ) {
      gsmResult = fallbackGsm;
      phoneLandline = fallbackGsm.formatted;
    }
  }
  const rawEmail = readCellText(infoSheet, 'D23');
  const slugify = (s: string): string =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  const email =
    rawEmail ||
    `${slugify(firstName) || 'candidat'}.${slugify(lastName) || 'cmn'}@lifras.be`;
  const febrasNumber = normalizeTextIdentifier(readCellRaw(infoSheet, 'D27'));

  const cfpsRaw = readCellRaw(infoSheet, 'D28');
  const cfpsParsed =
    cfpsRaw !== undefined && cfpsRaw !== null && String(cfpsRaw).trim() !== ''
      ? Number.parseInt(String(cfpsRaw).trim(), 10)
      : null;
  const cfpsYear = cfpsParsed !== null && !Number.isNaN(cfpsParsed) ? cfpsParsed : null;

  let cfpsYearWarning: string | null = null;
  if (cfpsYear !== null) {
    if (cfpsYear > currentYear) {
      cfpsYearWarning = `Alerte d'intégrité : l'année CFPS extraite (${cfpsYear} en cellule D28) est dans le futur (> ${currentYear}).`;
    } else if (cfpsYear < 1950) {
      cfpsYearWarning = `Alerte d'intégrité : l'année CFPS extraite (${cfpsYear} en cellule D28) est antérieure à 1950.`;
    }
  }

  const mfRaw = readCellRaw(infoSheet, 'G28');
  const mfParsed =
    mfRaw !== undefined && mfRaw !== null && String(mfRaw).trim() !== ''
      ? Number.parseInt(String(mfRaw).trim(), 10)
      : null;
  const mfYear = mfParsed !== null && !Number.isNaN(mfParsed) ? mfParsed : null;

  const divesRaw = readCellRaw(infoSheet, 'D30');
  const divesParsed =
    divesRaw !== undefined && divesRaw !== null && String(divesRaw).trim() !== ''
      ? Number.parseInt(String(divesRaw).trim(), 10)
      : null;
  const divesCount =
    divesParsed !== null && !Number.isNaN(divesParsed) && divesParsed >= 0
      ? divesParsed
      : null;

  const clubName = normalizeTextIdentifier(readCellRaw(infoSheet, 'D34'));
  const clubPresident = normalizeTextIdentifier(readCellRaw(infoSheet, 'G34'));
  const clubHeadInstructor = normalizeTextIdentifier(readCellRaw(infoSheet, 'D36'));

  return {
    last_name: lastName,
    first_name: firstName,
    birth_date: birthDate,
    street_address: streetAddress,
    postal_code: postalCode,
    city,
    phone_landline: phoneLandline,
    phone_gsm: gsmResult.formatted,
    gsm_zero_restored: gsmResult.zeroRestored,
    email,
    febras_number: febrasNumber,
    cfps_year: cfpsYear,
    cfps_year_warning: cfpsYearWarning,
    mf_year: mfYear,
    dives_count: divesCount,
    club_name: clubName,
    club_president: clubPresident,
    club_head_instructor: clubHeadInstructor,
  };
}

/**
 * Recalcule l'aperçu du Tableau de Bord Iso-Excel à partir des lignes d'évaluations extraites.
 */
export function computePreviewFromParsedRows(
  rows: ParsedExcelEvaluationRow[],
  criteria: Criterion[] = OFFICIAL_CRITERIA
): CandidateScoreboardResult {
  const evaluations: Pick<Evaluation, 'id' | 'exam_code' | 'status'>[] = [];
  const evaluationScores: EvaluationScore[] = [];

  for (const row of rows) {
    if (!row.exam_code) continue;
    evaluations.push({
      id: row.tempId,
      exam_code: row.exam_code,
      status: 'PUBLISHED',
    });

    for (const sc of row.scores) {
      evaluationScores.push({
        evaluation_id: row.tempId,
        criterion_id: sc.criterion_id,
        grade: sc.grade,
      });
    }
  }

  return computeCandidateScoreboard(evaluations, evaluationScores, criteria, 'ISO_EXCEL');
}

/**
 * Parse un classeur Excel complet (.xlsx sous forme d'ArrayBuffer) et retourne
 * la fiche candidat, les évaluations mappées (I à DE), la résolution des jurys MN
 * et le contrôle mathématique des 5 moyennes Iso-Excel.
 */
export function parseCmnExcelWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
  mnDirectory: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'aliases'>[],
  criteria: Criterion[] = OFFICIAL_CRITERIA
): ExcelWorkbookImportPreview {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetNames = workbook.SheetNames;
  const warnings: string[] = [];

  // Recherche souple des feuilles "Informations personnelles" et "Données"
  const infoSheetName =
    sheetNames.find((n) => n.toLowerCase().includes('informations')) ?? sheetNames[0];
  const dataSheetName =
    sheetNames.find(
      (n) =>
        n.toLowerCase() === 'données' ||
        n.toLowerCase() === 'donnees' ||
        n.toLowerCase().includes('donn')
    ) ?? sheetNames[1];

  const infoSheet = infoSheetName ? workbook.Sheets[infoSheetName] : undefined;
  const dataSheet = dataSheetName ? workbook.Sheets[dataSheetName] : undefined;

  if (!infoSheet) {
    warnings.push('Feuille « Informations personnelles » introuvable dans le classeur.');
  }
  if (!dataSheet) {
    warnings.push('Feuille « Données » introuvable dans le classeur.');
  }

  const candidate = extractCandidateProfileFromSheet(infoSheet);
  if (candidate.cfps_year_warning) {
    warnings.push(candidate.cfps_year_warning);
  }
  if (candidate.gsm_zero_restored) {
    warnings.push(
      `Numéro GSM belge normalisé automatiquement avec rétablissement du 0 initial : ${candidate.phone_gsm}`
    );
  }

  const evaluations: ParsedExcelEvaluationRow[] = [];

  if (dataSheet && dataSheet['!ref']) {
    const range = XLSX.utils.decode_range(dataSheet['!ref']);
    // Détecte automatiquement si la feuille Données est au format MATRIX 94 colonnes (commentaires en CO/CP)
    // ou au format standard 109 colonnes (commentaires en DD/DE)
    const headerCO = readCellText(dataSheet, 'CO1').toLowerCase();
    const headerCP = readCellText(dataSheet, 'CP1').toLowerCase();
    const isMatrix94Format =
      headerCO.includes('améliorer') ||
      headerCO.includes('ameliorer') ||
      headerCP.includes('points forts') ||
      range.e.c <= 95;

    const criterionById = new Map<number, Criterion>();
    for (const c of criteria) {
      criterionById.set(c.id, c);
    }

    // Parcourt toutes les lignes à partir de la ligne 2 (index 1 en base 0, Excel row = r + 1)
    for (let r = 1; r <= range.e.r; r++) {
      const excelRowNum = r + 1;
      const rawFormsLabel = readCellText(dataSheet, `H${excelRowNum}`);
      const rawEvaluator = readCellText(dataSheet, `F${excelRowNum}`);
      const rawEventDate = readCellRaw(dataSheet, `G${excelRowNum}`);

      // Ignorer les lignes totalement vides
      if (!rawFormsLabel && !rawEvaluator && !rawEventDate) {
        continue;
      }

      const legacyIdRaw = readCellRaw(dataSheet, `A${excelRowNum}`);
      const legacyRowId =
        typeof legacyIdRaw === 'number'
          ? legacyIdRaw
          : Number.parseInt(String(legacyIdRaw ?? excelRowNum), 10) || excelRowNum;

      const matchedExamCode = matchExamCodeFromFormsLabel(rawFormsLabel);
      let examWarning: string | null = null;
      if (!matchedExamCode) {
        examWarning = `Ligne ${excelRowNum} : Libellé d'épreuve non reconnu en colonne H ("${rawFormsLabel}").`;
        warnings.push(examWarning);
      }

      const eventDate =
        parseExcelDateToIso(rawEventDate) ?? new Date().toISOString().slice(0, 10);
      const startedAt = parseExcelTimestampToIso(readCellRaw(dataSheet, `B${excelRowNum}`));
      const submittedAt = parseExcelTimestampToIso(readCellRaw(dataSheet, `C${excelRowNum}`));
      const improvementsComment = isMatrix94Format
        ? readCellText(dataSheet, `CO${excelRowNum}`) ||
          readCellText(dataSheet, `DD${excelRowNum}`)
        : readCellText(dataSheet, `DD${excelRowNum}`) ||
          readCellText(dataSheet, `CO${excelRowNum}`);
      const strengthsComment = isMatrix94Format
        ? readCellText(dataSheet, `CP${excelRowNum}`) ||
          readCellText(dataSheet, `DE${excelRowNum}`)
        : readCellText(dataSheet, `DE${excelRowNum}`) ||
          readCellText(dataSheet, `CP${excelRowNum}`);

      // Mapper chaque colonne de cotation selon le format du classeur (MATRIX 94 colonnes ou Standard 109 colonnes)
      const rowScores: { criterion_id: number; excel_col: string; grade: GradeCode }[] = [];
      if (isMatrix94Format) {
        for (const [colLetter, critId] of Object.entries(
          MATRIX_94_COL_TO_CRITERION_ID
        )) {
          const crit = criterionById.get(critId);
          if (!crit) continue;
          const rawGradeVal = readCellRaw(dataSheet, `${colLetter}${excelRowNum}`);
          const grade = normalizeGradeCell(rawGradeVal);
          if (grade && (!matchedExamCode || crit.exam_code === matchedExamCode)) {
            rowScores.push({
              criterion_id: crit.id,
              excel_col: crit.excel_col,
              grade,
            });
          }
        }
      } else {
        for (const crit of criteria) {
          const cellAddr = `${crit.excel_col}${excelRowNum}`;
          const rawGradeVal = readCellRaw(dataSheet, cellAddr);
          const grade = normalizeGradeCell(rawGradeVal);
          if (grade) {
            if (!matchedExamCode || crit.exam_code === matchedExamCode) {
              rowScores.push({
                criterion_id: crit.id,
                excel_col: crit.excel_col,
                grade,
              });
            }
          }
        }
      }

      const juryMatches = resolveJuryCell(rawEvaluator, mnDirectory);

      evaluations.push({
        tempId: `import-row-${excelRowNum}`,
        legacy_row_id: legacyRowId,
        raw_forms_label: rawFormsLabel,
        exam_code: matchedExamCode,
        exam_recognition_warning: examWarning,
        event_date: eventDate,
        started_at: startedAt,
        submitted_at: submittedAt,
        legacy_evaluator_raw: rawEvaluator,
        jury_matches: juryMatches,
        improvements_comment: improvementsComment,
        strengths_comment: strengthsComment,
        scores: rowScores,
      });
    }
  }

  const scoreboardPreview = computePreviewFromParsedRows(evaluations, criteria);

  return {
    fileName,
    sheetNames,
    candidate,
    evaluations,
    scoreboardPreview,
    warnings,
  };
}

/**
 * Génère en mémoire un classeur Excel `.xlsx` de démonstration contenant le Golden Dataset
 * (20 évaluations + feuille Informations personnelles avec GSM belge à 9 chiffres et année CFPS future)
 * afin que l'administrateur DTF puisse tester l'importateur en un clic ou télécharger un modèle.
 */
export function buildSampleGoldenWorkbookBuffer(): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // 1. Feuille Informations personnelles
  const infoSheet: XLSX.WorkSheet = {};
  const setCell = (sheet: XLSX.WorkSheet, addr: string, val: string | number): void => {
    sheet[addr] = { t: typeof val === 'number' ? 'n' : 's', v: val };
  };

  setCell(infoSheet, 'D11', 'Peeters');
  setCell(infoSheet, 'G11', 'Thomas');
  setCell(infoSheet, 'D13', '1988-06-30');
  setCell(infoSheet, 'D16', 'Rue de la Zélande 42');
  setCell(infoSheet, 'D18', '1300');
  setCell(infoSheet, 'G18', 'Wavre');
  setCell(infoSheet, 'D21', '010223344');
  // GSM sous forme numérique à 9 chiffres commençant par 4 (teste le rétablissement du 0 initial)
  setCell(infoSheet, 'G21', 479445566);
  setCell(infoSheet, 'D23', 'thomas.peeters@lifras.be');
  setCell(infoSheet, 'D27', '0054321');
  // Année CFPS future (teste l'alerte visuelle d'année incohérente)
  setCell(infoSheet, 'D28', 2099);
  setCell(infoSheet, 'G28', 2021);
  setCell(infoSheet, 'D30', 640);
  setCell(infoSheet, 'D34', 'Nautilus Club');
  setCell(infoSheet, 'G34', 'Marc Vandevelde');
  setCell(infoSheet, 'D36', 'Luc Moreau');
  infoSheet['!ref'] = 'A1:H40';

  XLSX.utils.book_append_sheet(wb, infoSheet, 'Informations personnelles');

  // 2. Feuille Données (20 lignes correspondant exactement au Golden Dataset)
  const dataSheet: XLSX.WorkSheet = {};
  setCell(dataSheet, 'A1', 'ID');
  setCell(dataSheet, 'B1', 'Heure de début');
  setCell(dataSheet, 'C1', 'Heure de fin');
  setCell(dataSheet, 'F1', 'Nom du ou des MN examinateur(s)');
  setCell(dataSheet, 'G1', 'Date de la prestation');
  setCell(dataSheet, 'H1', 'Type de prestation');
  setCell(dataSheet, 'DD1', 'Ce que le CMN doit améliorer');
  setCell(dataSheet, 'DE1', 'Ce que le CMN doit garder');

  for (const crit of OFFICIAL_CRITERIA) {
    setCell(dataSheet, `${crit.excel_col}1`, crit.question_text);
  }

  interface SampleRowSpec {
    formsLabel: string;
    evaluatorRaw: string;
    date: string;
    gradesByCol: Record<string, GradeCode>;
    improve: string;
    keep: string;
  }

  const rows: SampleRowSpec[] = [
    // 1. COURS_MF (1 éval) : LEAD(3 TB), FORM(3 TB), CONN(2 TB)
    {
      formsLabel: 'Cours niveau MF',
      evaluatorRaw: 'Lambert Jean-Marc & Claire Dubois',
      date: '2026-02-10',
      gradesByCol: { I: 'TB', J: 'TB', K: 'TB', L: 'TB', M: 'TB', N: 'TB', O: 'TB', P: 'TB' },
      improve: 'RAS sur ce cours théorique.',
      keep: 'Excellente maîtrise du sujet et clarté du support.',
    },
    // 2..5. PEDA_AM_MC (4 évals) : LEAD(6 TB, 2 B), FORM(12 TB, 4 B), CONN(4 TB)
    {
      formsLabel: 'Pédagogie AM ou MC',
      evaluatorRaw: 'J-M Lambert',
      date: '2026-03-01',
      gradesByCol: { Q: 'TB', R: 'TB', S: 'TB', T: 'TB', U: 'TB', V: 'TB', W: 'TB' },
      improve: 'Synthétiser plus rapidement le débriefing.',
      keep: 'Écoute active remarquable.',
    },
    {
      formsLabel: 'Pédagogie AM ou MC',
      evaluatorRaw: 'Dubois Claire, Marc Vandevelde',
      date: '2026-03-08',
      gradesByCol: { Q: 'TB', R: 'TB', S: 'TB', T: 'TB', U: 'TB', V: 'TB', W: 'TB' },
      improve: 'RAS.',
      keep: 'Pertinence des conseils pédagogiques.',
    },
    {
      formsLabel: 'Pédagogie AM ou MC',
      evaluatorRaw: 'Jean-Marc Lambert et Philippe Hendrickx',
      date: '2026-03-15',
      gradesByCol: { Q: 'TB', R: 'B', S: 'TB', T: 'TB', U: 'B', V: 'B', W: 'TB' },
      improve: 'Structurer la grille d’observation.',
      keep: 'Bienveillance envers le candidat.',
    },
    {
      formsLabel: 'Pédagogie AM ou MC',
      evaluatorRaw: 'Hendrickx Philippe',
      date: '2026-03-22',
      gradesByCol: { Q: 'TB', R: 'B', S: 'TB', T: 'TB', U: 'B', V: 'B', W: 'TB' },
      improve: 'Gérer le timing de parole.',
      keep: 'Maîtrise réglementaire.',
    },
    // 6..7. FORMATION_MF_REG (2 évals) : LEAD(6 TB), FORM(11 TB, 1 NE), CONN(3 TB, 1 NE)
    {
      formsLabel: "Formation d'un MF (dans une association régionale)",
      evaluatorRaw: 'Jean-Marc Lambert',
      date: '2026-04-05',
      gradesByCol: {
        X: 'TB', Y: 'TB', Z: 'TB',
        AA: 'TB', AB: 'TB', AC: 'TB', AD: 'TB', AE: 'TB', AF: 'TB',
        AG: 'TB', AH: 'TB',
      },
      improve: 'RAS.',
      keep: 'Démonstration impeccable.',
    },
    {
      formsLabel: "Formation d'un MF (dans une association régionale)",
      evaluatorRaw: 'Claire Dubois',
      date: '2026-04-12',
      gradesByCol: {
        X: 'TB', Y: 'TB', Z: 'TB',
        AA: 'TB', AB: 'TB', AC: 'TB', AD: 'TB', AE: 'TB', AF: 'NE',
        AG: 'TB', AH: 'NE',
      },
      improve: 'Prévoir un second exemple pratique.',
      keep: 'Leadership naturel.',
    },
    // 8..13. STAGE_EXPERIENCE (6 évals) : LEAD(2 TB, 7 B, 6 S, 2 I, 1 NE), ORG(3 TB, 6 B, 8 S, 7 NE), CONN(3 TB, 3 B, 5 S, 1 NE)
    {
      formsLabel: "Stage d'expérience",
      evaluatorRaw: 'Lambert Jean-Marc',
      date: '2026-05-01',
      gradesByCol: { AI: 'TB', AJ: 'TB', AK: 'B', AL: 'TB', AM: 'TB', AN: 'TB', AO: 'B', AP: 'TB', AQ: 'TB' },
      improve: 'Anticiper la météo locale.',
      keep: 'Briefing sécurité carré.',
    },
    {
      formsLabel: "Stage d'expérience",
      evaluatorRaw: 'Dubois Claire',
      date: '2026-05-02',
      gradesByCol: { AI: 'B', AJ: 'B', AK: 'B', AL: 'B', AM: 'B', AN: 'B', AO: 'B', AP: 'TB', AQ: 'B' },
      improve: 'Vérifier les palanquées plus tôt.',
      keep: 'Calme lors de l’exercice.',
    },
    {
      formsLabel: "Stage d'expérience",
      evaluatorRaw: 'Hendrickx Philippe',
      date: '2026-05-03',
      gradesByCol: { AI: 'B', AJ: 'B', AK: 'B', AL: 'B', AM: 'S', AN: 'S', AO: 'S', AP: 'B', AQ: 'B' },
      improve: 'Déléguer le relevé des paramètres.',
      keep: 'Présence rassurante.',
    },
    {
      formsLabel: "Stage d'expérience",
      evaluatorRaw: 'Jean-Marc Lambert & Claire Dubois',
      date: '2026-05-04',
      gradesByCol: { AI: 'S', AJ: 'S', AK: 'S', AL: 'S', AM: 'S', AN: 'S', AO: 'S', AP: 'S', AQ: 'S' },
      improve: 'Améliorer la gestion de l’incident simulé.',
      keep: 'Respect des consignes.',
    },
    {
      formsLabel: "Stage d'expérience",
      evaluatorRaw: 'Vandevelde Marc',
      date: '2026-05-05',
      gradesByCol: { AI: 'S', AJ: 'S', AK: 'S', AL: 'S', AM: 'NE', AN: 'NE', AO: 'NE', AP: 'S', AQ: 'S' },
      improve: 'Prendre des décisions plus rapides.',
      keep: 'Écoute de l’équipe.',
    },
    {
      formsLabel: "Stage d'expérience",
      evaluatorRaw: 'Moreau Luc',
      date: '2026-05-06',
      gradesByCol: { AI: 'I', AJ: 'I', AK: 'NE', AL: 'NE', AM: 'NE', AN: 'NE', AO: 'NE', AP: 'S', AQ: 'NE' },
      improve: 'Travailler la prestance face à un grand groupe.',
      keep: 'Connaissance des règlements.',
    },
    // 14. TRAVAIL_POLE (1 éval) : CONC(4 TB, 1 NE), CONN(1 TB)
    {
      formsLabel: "Travail pour la commission de l'enseignement (dans un pôle par exemple)",
      evaluatorRaw: 'DTF LIFRAS',
      date: '2026-06-01',
      gradesByCol: { AR: 'TB', AS: 'TB', AT: 'TB', AU: 'TB', AV: 'NE', AW: 'TB' },
      improve: 'RAS.',
      keep: 'Esprit de synthèse très apprécié en groupe de travail.',
    },
    // 15..17. EXAMEN_THEORIQUE (3 évals) : CONN(2 B, 1 S), FORM(1 B, 2 S)
    {
      formsLabel: 'Examen théorique',
      evaluatorRaw: 'Jean-Marc Lambert',
      date: '2026-06-15',
      gradesByCol: { AX: 'B', AY: 'B' },
      improve: 'Approfondir la physiologie hyperbare.',
      keep: 'Structure claire.',
    },
    {
      formsLabel: 'Examen théorique',
      evaluatorRaw: 'Claire Dubois',
      date: '2026-06-15',
      gradesByCol: { AX: 'B', AY: 'S' },
      improve: 'Illustrer par des schémas.',
      keep: 'Précision réglementaire.',
    },
    {
      formsLabel: 'Examen théorique',
      evaluatorRaw: 'Philippe Hendrickx',
      date: '2026-06-15',
      gradesByCol: { AX: 'S', AY: 'S' },
      improve: 'Attention au temps imparti.',
      keep: 'Bonne posture.',
    },
    // 18. GESTION_DEBAT (1 éval) : LEAD(2 S, 1 I), CONC(2 B, 2 S), CONN(1 TB)
    {
      formsLabel: "Gestion d'un débat",
      evaluatorRaw: 'Lambert Jean-Marc, Dubois Claire',
      date: '2026-07-01',
      gradesByCol: { AZ: 'S', BA: 'S', BB: 'I', BC: 'B', BD: 'B', BE: 'S', BF: 'S', BG: 'TB' },
      improve: 'Canaliser les intervenants dominants.',
      keep: 'Excellente synthèse finale.',
    },
    // 19. ORGA_MER (1 éval) : LEAD(3 S, 1 I), ORG(1 B, 3 S), CONN(1 B)
    {
      formsLabel: 'Examen organisation mer',
      evaluatorRaw: 'Hendrickx Philippe & Moreau Luc',
      date: '2026-08-20',
      gradesByCol: { BH: 'S', BI: 'S', BJ: 'S', BK: 'I', BL: 'B', BM: 'S', BN: 'S', BO: 'S', BP: 'B' },
      improve: 'Porter la voix lors du briefing sur le quai.',
      keep: 'Sécurité surface bien pensée.',
    },
    // 20. ORGA_CARRIERE (1 éval) : LEAD(4 TB), FORM(2 TB), ORG(2 TB, 1 B, 1 NE), CONN(2 TB)
    {
      formsLabel: 'Examen organisation carrière',
      evaluatorRaw: 'Jean-Marc Lambert',
      date: '2026-09-12',
      gradesByCol: {
        BQ: 'TB', BR: 'TB', BS: 'TB', BT: 'TB',
        BU: 'TB', BV: 'TB',
        BW: 'TB', BX: 'TB', BY: 'B', BZ: 'NE',
        CA: 'TB', CB: 'TB',
      },
      improve: 'Formaliser le débriefing post-plongée.',
      keep: 'Organisation globale exemplaire.',
    },
  ];

  rows.forEach((spec, idx) => {
    const r = idx + 2;
    setCell(dataSheet, `A${r}`, idx + 1);
    setCell(dataSheet, `B${r}`, `${spec.date}T08:30:00Z`);
    setCell(dataSheet, `C${r}`, `${spec.date}T12:15:00Z`);
    setCell(dataSheet, `F${r}`, spec.evaluatorRaw);
    setCell(dataSheet, `G${r}`, spec.date);
    setCell(dataSheet, `H${r}`, spec.formsLabel);
    setCell(dataSheet, `DD${r}`, spec.improve);
    setCell(dataSheet, `DE${r}`, spec.keep);

    for (const [col, grade] of Object.entries(spec.gradesByCol)) {
      setCell(dataSheet, `${col}${r}`, grade);
    }
  });

  dataSheet['!ref'] = 'A1:DE25';
  XLSX.utils.book_append_sheet(wb, dataSheet, 'Données');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return out;
}
