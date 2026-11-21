import { APP_VERSION } from '@/domain/referentials';
import type { Evaluation, EvaluationScore, Profile } from '@/domain/types';
import { isSupabaseConfigured, supabase } from '@/services/supabaseClient';

const BACKUPS_INDEX_KEY = 'cmn_backups_index';
const BACKUP_ITEM_PREFIX = 'cmn_backup_';
const MAX_CLOUD_BACKUPS = 15;
const DAILY_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface BackupSnapshotMeta {
  id: string;
  created_at: string;
  created_by: string;
  mode: 'AUTO' | 'MANUAL';
  label: string;
  app_version: string;
  counts: {
    candidates: number;
    evaluations: number;
    scores: number;
    mn_directory: number;
  };
}

export interface BackupSnapshotPayload {
  meta: BackupSnapshotMeta;
  candidates: Profile[];
  evaluations: Evaluation[];
  scores: EvaluationScore[];
  mn_directory: Profile[];
}

export interface BackupSourceData {
  candidates: Profile[];
  evaluations: Evaluation[];
  scores: EvaluationScore[];
  mn_directory: Profile[];
}

function buildBackupId(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(
    date.getSeconds()
  )}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `bkp-${stamp}-${rand}`;
}

export async function listCloudBackups(): Promise<BackupSnapshotMeta[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('cmn_shared_state')
      .select('payload')
      .eq('key', BACKUPS_INDEX_KEY)
      .maybeSingle();

    if (error || !data || !Array.isArray(data.payload)) {
      return [];
    }
    return (data.payload as BackupSnapshotMeta[]).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  } catch {
    return [];
  }
}

export async function createCloudBackup(
  source: BackupSourceData,
  options: {
    createdBy: string;
    mode: 'AUTO' | 'MANUAL';
    label?: string;
  }
): Promise<{ ok: boolean; meta?: BackupSnapshotMeta; error?: string }> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error: 'Supabase n’est pas configuré sur cette instance.',
    };
  }

  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const id = buildBackupId(now);
    const meta: BackupSnapshotMeta = {
      id,
      created_at: nowIso,
      created_by: options.createdBy || 'Système CMN',
      mode: options.mode,
      label:
        options.label?.trim() ||
        (options.mode === 'AUTO'
          ? 'Sauvegarde automatique quotidienne'
          : 'Sauvegarde manuelle Administrateur'),
      app_version: APP_VERSION,
      counts: {
        candidates: source.candidates.length,
        evaluations: source.evaluations.length,
        scores: source.scores.length,
        mn_directory: source.mn_directory.length,
      },
    };

    const payload: BackupSnapshotPayload = {
      meta,
      candidates: source.candidates,
      evaluations: source.evaluations,
      scores: source.scores,
      mn_directory: source.mn_directory,
    };

    const { error: snapError } = await supabase.from('cmn_shared_state').upsert({
      key: `${BACKUP_ITEM_PREFIX}${id}`,
      payload,
      updated_at: nowIso,
    });

    if (snapError) {
      return {
        ok: false,
        error: `Erreur d’écriture Supabase : ${snapError.message}`,
      };
    }

    const existing = await listCloudBackups();
    const updatedIndex = [meta, ...existing.filter((b) => b.id !== id)];
    const kept = updatedIndex.slice(0, MAX_CLOUD_BACKUPS);
    const pruned = updatedIndex.slice(MAX_CLOUD_BACKUPS);

    const { error: indexError } = await supabase.from('cmn_shared_state').upsert({
      key: BACKUPS_INDEX_KEY,
      payload: kept,
      updated_at: nowIso,
    });

    if (indexError) {
      return {
        ok: false,
        error: `Snapshot enregistré mais index non mis à jour : ${indexError.message}`,
      };
    }

    if (pruned.length > 0) {
      await Promise.all(
        pruned.map((old) =>
          supabase
            .from('cmn_shared_state')
            .delete()
            .eq('key', `${BACKUP_ITEM_PREFIX}${old.id}`)
        )
      );
    }

    return { ok: true, meta };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Erreur inattendue lors de la sauvegarde Supabase.',
    };
  }
}

export async function ensureDailyAutoBackup(
  source: BackupSourceData,
  createdBy = 'Automatique (24h)'
): Promise<boolean> {
  if (!isSupabaseConfigured || source.candidates.length === 0) return false;
  try {
    const existing = await listCloudBackups();
    const latest = existing[0];
    if (latest) {
      const ageMs = Date.now() - new Date(latest.created_at).getTime();
      if (Number.isFinite(ageMs) && ageMs < DAILY_BACKUP_INTERVAL_MS) {
        return false;
      }
    }
    const res = await createCloudBackup(source, {
      createdBy,
      mode: 'AUTO',
      label: 'Sauvegarde automatique quotidienne',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loadCloudBackupSnapshot(
  backupId: string
): Promise<BackupSnapshotPayload | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('cmn_shared_state')
      .select('payload')
      .eq('key', `${BACKUP_ITEM_PREFIX}${backupId}`)
      .maybeSingle();

    if (error || !data || !data.payload) {
      return null;
    }
    return data.payload as BackupSnapshotPayload;
  } catch {
    return null;
  }
}

export async function deleteCloudBackup(backupId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await supabase
      .from('cmn_shared_state')
      .delete()
      .eq('key', `${BACKUP_ITEM_PREFIX}${backupId}`);

    const existing = await listCloudBackups();
    const filtered = existing.filter((b) => b.id !== backupId);
    const { error } = await supabase.from('cmn_shared_state').upsert({
      key: BACKUPS_INDEX_KEY,
      payload: filtered,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

export function downloadBackupAsJsonFile(payload: BackupSnapshotPayload): void {
  const safeStamp = payload.meta.created_at
    .slice(0, 16)
    .replace('T', '_')
    .replace(':', 'h');
  const filename = `sauvegarde-cmn-lifras_${safeStamp}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
