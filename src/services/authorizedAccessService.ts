import type { Profile } from '@/domain/types';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export interface AuthorizedCredential {
  email: string;
  profileId: string;
  passwordHash: string;
  updatedAt: string;
}

const CREDENTIALS_CLOUD_KEY = 'authorized_credentials';
const CREDENTIALS_LOCAL_KEY = 'cmn_lifras_authorized_credentials_v1';
const ACTIVE_SESSION_LOCAL_KEY = 'cmn_lifras_authorized_session_v1';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(
  email: string,
  password: string
): Promise<string> {
  const input = `cmn-lifras-v2:${normalizeEmail(email)}:${password}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback déterministe si crypto.subtle indisponible (ex. contexte HTTP non-localhost)
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv-${(h >>> 0).toString(16)}`;
}

function loadLocalCredentials(): AuthorizedCredential[] {
  try {
    const raw = localStorage.getItem(CREDENTIALS_LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuthorizedCredential[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalCredentials(creds: AuthorizedCredential[]): void {
  try {
    localStorage.setItem(CREDENTIALS_LOCAL_KEY, JSON.stringify(creds));
  } catch {
    // Ignore quota errors
  }
}

export function loadSavedAuthorizedSession(): Profile | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    return parsed && parsed.id && parsed.email ? parsed : null;
  } catch {
    return null;
  }
}

export function saveAuthorizedSession(profile: Profile | null): void {
  try {
    if (!profile) {
      localStorage.removeItem(ACTIVE_SESSION_LOCAL_KEY);
    } else {
      localStorage.setItem(ACTIVE_SESSION_LOCAL_KEY, JSON.stringify(profile));
    }
  } catch {
    // Ignore
  }
}

export async function fetchAuthorizedCredentials(): Promise<
  AuthorizedCredential[]
> {
  const local = loadLocalCredentials();
  if (!isSupabaseConfigured) return local;
  try {
    const { data, error } = await supabase
      .from('cmn_shared_state')
      .select('payload')
      .eq('key', CREDENTIALS_CLOUD_KEY)
      .maybeSingle();
    if (!error && Array.isArray(data?.payload)) {
      const remote = data.payload as AuthorizedCredential[];
      saveLocalCredentials(remote);
      return remote;
    }
  } catch {
    // Fallback local
  }
  return local;
}

export async function setAuthorizedPassword(
  email: string,
  profileId: string,
  password: string
): Promise<void> {
  const norm = normalizeEmail(email);
  const passwordHash = await hashPassword(norm, password);
  const nowIso = new Date().toISOString();
  const current = await fetchAuthorizedCredentials();
  const next: AuthorizedCredential[] = [
    {
      email: norm,
      profileId,
      passwordHash,
      updatedAt: nowIso,
    },
    ...current.filter((c) => normalizeEmail(c.email) !== norm),
  ];
  saveLocalCredentials(next);
  if (isSupabaseConfigured) {
    try {
      await supabase.from('cmn_shared_state').upsert({
        key: CREDENTIALS_CLOUD_KEY,
        payload: next,
        updated_at: nowIso,
      });
    } catch {
      // Offline fallback
    }
  }
}

export async function resetAuthorizedPassword(email: string): Promise<void> {
  const norm = normalizeEmail(email);
  const nowIso = new Date().toISOString();
  const current = await fetchAuthorizedCredentials();
  const next = current.filter((c) => normalizeEmail(c.email) !== norm);
  saveLocalCredentials(next);
  if (isSupabaseConfigured) {
    try {
      await supabase.from('cmn_shared_state').upsert({
        key: CREDENTIALS_CLOUD_KEY,
        payload: next,
        updated_at: nowIso,
      });
    } catch {
      // Offline fallback
    }
  }
}

export async function verifyAuthorizedPassword(
  email: string,
  password: string
): Promise<'OK' | 'NO_PASSWORD_SET' | 'WRONG_PASSWORD'> {
  const norm = normalizeEmail(email);
  const creds = await fetchAuthorizedCredentials();
  const entry = creds.find((c) => normalizeEmail(c.email) === norm);
  if (!entry) return 'NO_PASSWORD_SET';
  const candidateHash = await hashPassword(norm, password);
  return candidateHash === entry.passwordHash ? 'OK' : 'WRONG_PASSWORD';
}

export async function findAuthorizedProfileByEmail(
  email: string
): Promise<Profile | null> {
  const norm = normalizeEmail(email);
  if (!norm) return null;

  // 1. Recherche prioritaire dans Supabase cmn_shared_state (toujours à jour même sur un nouvel appareil)
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('cmn_shared_state')
        .select('key, payload')
        .in('key', ['mn_directory', 'candidates', 'deleted_profile_ids']);
      if (!error && Array.isArray(data)) {
        const deletedRow = data.find((r) => r.key === 'deleted_profile_ids');
        const deletedIds = new Set<string>(
          Array.isArray(deletedRow?.payload)
            ? (deletedRow.payload as string[])
            : []
        );
        for (const row of data) {
          if (row.key !== 'mn_directory' && row.key !== 'candidates') continue;
          if (!Array.isArray(row.payload)) continue;
          const match = (row.payload as Profile[]).find(
            (p) =>
              p &&
              typeof p.email === 'string' &&
              normalizeEmail(p.email) === norm &&
              !deletedIds.has(p.id)
          );
          if (match) return match;
        }
      }
    } catch {
      // Fallback local ci-dessous
    }
  }

  // 2. Fallback dans le stockage local (mode hors-ligne)
  try {
    const deletedRaw = localStorage.getItem('cmn_lifras_deleted_profiles_v1');
    const deletedIds = new Set<string>(
      deletedRaw ? (JSON.parse(deletedRaw) as string[]) : []
    );
    for (const key of [
      'cmn_lifras_mn_directory_v1',
      'cmn_lifras_candidates_v1',
    ]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const list = JSON.parse(raw) as Profile[];
      if (!Array.isArray(list)) continue;
      const match = list.find(
        (p) =>
          p &&
          typeof p.email === 'string' &&
          normalizeEmail(p.email) === norm &&
          !deletedIds.has(p.id)
      );
      if (match) return match;
    }
  } catch {
    // Ignore
  }

  return null;
}
