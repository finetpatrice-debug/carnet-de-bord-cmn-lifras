import type { Profile } from '@/domain/types';

export interface JuryMatchCandidate {
  rawToken: string;
  matchedProfileId: string | null;
  matchedFullName: string | null;
  confidence: number; // 0 à 1
  matchMethod: 'EXACT' | 'INVERTED' | 'ALIAS' | 'FUZZY' | 'UNMATCHED';
}

/**
 * Normalise une chaîne de caractères :
 * minuscules, suppression des accents, suppression des titres ("MN", "M.N.")
 * et normalisation des espaces/tirets.
 */
export function normalizeNameString(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(mn|m\.n\.)\b/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Découpe la colonne F ("Nom du ou des MN examinateur(s)") en tokens individuels
 * en séparant sur `,`, `&`, `/`, `;`, `+` ou le mot `et` entouré d'espaces.
 */
export function splitEvaluatorRawString(rawCell: string): string[] {
  if (!rawCell || !rawCell.trim()) {
    return [];
  }
  return rawCell
    .split(/(?:,|&|\/|;|\+|\s+et\s+)/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Distance de Levenshtein classique entre deux chaînes normalisées.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/**
 * Calcule une similarité normalisée (entre 0 et 1) prenant en compte :
 * - l'égalité directe (Prénom Nom)
 * - l'inversion (Nom Prénom)
 * - la correspondance d'ensembles de mots
 */
export function computeNameSimilarity(query: string, target: string): number {
  const qNorm = normalizeNameString(query);
  const tNorm = normalizeNameString(target);

  if (!qNorm || !tNorm) return 0;
  if (qNorm === tNorm) return 1;

  // Vérification de l'inversion exacte des tokens (ex: "Lambert Jean-Marc" vs "Jean-Marc Lambert")
  const qTokens = qNorm.split(/[\s-]+/).filter(Boolean).sort().join(' ');
  const tTokens = tNorm.split(/[\s-]+/).filter(Boolean).sort().join(' ');
  if (qTokens === tTokens && qTokens.length > 0) {
    return 0.98;
  }

  // Distance de Levenshtein sur la chaîne directe et sur les tokens triés
  const maxLenDirect = Math.max(qNorm.length, tNorm.length);
  const simDirect = 1 - levenshteinDistance(qNorm, tNorm) / maxLenDirect;

  const maxLenSorted = Math.max(qTokens.length, tTokens.length);
  const simSorted =
    maxLenSorted > 0
      ? 1 - levenshteinDistance(qTokens, tTokens) / maxLenSorted
      : 0;

  return Math.max(simDirect, simSorted);
}

/**
 * Recherche le meilleur profil MN_EVALUATOR correspondant à un nom brut extrait d'Excel.
 */
export function matchSingleEvaluatorToken(
  rawToken: string,
  mnDirectory: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'aliases'>[]
): JuryMatchCandidate {
  const cleanedQuery = normalizeNameString(rawToken);
  if (!cleanedQuery) {
    return {
      rawToken,
      matchedProfileId: null,
      matchedFullName: null,
      confidence: 0,
      matchMethod: 'UNMATCHED',
    };
  }

  let bestProfile: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'aliases'> | null =
    null;
  let bestScore = 0;
  let bestMethod: JuryMatchCandidate['matchMethod'] = 'UNMATCHED';

  for (const mn of mnDirectory) {
    const forwardName = `${mn.first_name} ${mn.last_name}`;
    const reverseName = `${mn.last_name} ${mn.first_name}`;

    const normForward = normalizeNameString(forwardName);
    const normReverse = normalizeNameString(reverseName);

    // 1. Correspondance exacte Prénom Nom
    if (cleanedQuery === normForward) {
      return {
        rawToken,
        matchedProfileId: mn.id,
        matchedFullName: `${mn.first_name} ${mn.last_name}`,
        confidence: 1,
        matchMethod: 'EXACT',
      };
    }

    // 2. Correspondance exacte inversée Nom Prénom
    if (cleanedQuery === normReverse) {
      return {
        rawToken,
        matchedProfileId: mn.id,
        matchedFullName: `${mn.first_name} ${mn.last_name}`,
        confidence: 0.99,
        matchMethod: 'INVERTED',
      };
    }

    // 3. Correspondance via le tableau `aliases` du profil
    for (const alias of mn.aliases ?? []) {
      if (normalizeNameString(alias) === cleanedQuery) {
        return {
          rawToken,
          matchedProfileId: mn.id,
          matchedFullName: `${mn.first_name} ${mn.last_name}`,
          confidence: 0.97,
          matchMethod: 'ALIAS',
        };
      }
    }

    // 4. Appariement flou (Fuzzy Matching) sur le nom complet et les alias
    const candidatesToCompare = [forwardName, reverseName, ...(mn.aliases ?? [])];
    for (const cand of candidatesToCompare) {
      const sim = computeNameSimilarity(rawToken, cand);
      if (sim > bestScore) {
        bestScore = sim;
        bestProfile = mn;
        bestMethod = sim >= 0.98 ? 'INVERTED' : 'FUZZY';
      }
    }
  }

  if (bestProfile && bestScore >= 0.68) {
    return {
      rawToken,
      matchedProfileId: bestProfile.id,
      matchedFullName: `${bestProfile.first_name} ${bestProfile.last_name}`,
      confidence: Number(bestScore.toFixed(2)),
      matchMethod: bestMethod,
    };
  }

  return {
    rawToken,
    matchedProfileId: null,
    matchedFullName: null,
    confidence: Number(bestScore.toFixed(2)),
    matchMethod: 'UNMATCHED',
  };
}

/**
 * Découpe et apparie une cellule brute `Colonne F` avec l'annuaire des MN.
 */
export function resolveJuryCell(
  rawEvaluatorCell: string,
  mnDirectory: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'aliases'>[]
): JuryMatchCandidate[] {
  const tokens = splitEvaluatorRawString(rawEvaluatorCell);
  return tokens.map((token) => matchSingleEvaluatorToken(token, mnDirectory));
}
