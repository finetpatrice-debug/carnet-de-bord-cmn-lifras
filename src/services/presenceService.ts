import type { Profile, UserRole } from '@/domain/types';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export interface OnlineUserPresence {
  sessionKey: string;
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  device: 'GSM' | 'PC';
  connectedAt: string;
}

export interface ConnectionLogEntry {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  device: 'GSM' | 'PC';
  connectedAt: string;
}

const CONNECTION_LOGS_KEY = 'connection_logs';
const MAX_CONNECTION_LOGS = 100;
const SESSION_LOGGED_KEY = 'cmn_lifras_conn_logged_v1';

export function detectDeviceType(): 'GSM' | 'PC' {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'PC';
  }
  const ua = navigator.userAgent || '';
  const isMobileUa = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(ua);
  const isSmallScreen = window.innerWidth < 768;
  return isMobileUa || isSmallScreen ? 'GSM' : 'PC';
}

export async function recordConnectionEvent(profile: Profile): Promise<void> {
  if (!isSupabaseConfigured || !profile?.id) return;
  try {
    const marker = `${profile.id}:${profile.email.toLowerCase()}`;
    if (
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem(SESSION_LOGGED_KEY) === marker
    ) {
      return;
    }

    const nowIso = new Date().toISOString();
    const entry: ConnectionLogEntry = {
      id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: profile.id,
      fullName: `${profile.first_name} ${profile.last_name}`.trim(),
      email: profile.email,
      role: profile.role,
      device: detectDeviceType(),
      connectedAt: nowIso,
    };

    const { data } = await supabase
      .from('cmn_shared_state')
      .select('payload')
      .eq('key', CONNECTION_LOGS_KEY)
      .maybeSingle();

    const existing = Array.isArray(data?.payload)
      ? (data.payload as ConnectionLogEntry[])
      : [];

    const nextLogs = [entry, ...existing].slice(0, MAX_CONNECTION_LOGS);

    await supabase.from('cmn_shared_state').upsert({
      key: CONNECTION_LOGS_KEY,
      payload: nextLogs,
      updated_at: nowIso,
    });

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_LOGGED_KEY, marker);
    }
  } catch {
    // Silencieux : ne jamais perturber l'application en mode hors-ligne
  }
}

export async function fetchConnectionLogs(): Promise<ConnectionLogEntry[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('cmn_shared_state')
      .select('payload')
      .eq('key', CONNECTION_LOGS_KEY)
      .maybeSingle();
    if (error || !Array.isArray(data?.payload)) return [];
    return data.payload as ConnectionLogEntry[];
  } catch {
    return [];
  }
}

export async function clearConnectionLogs(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('cmn_shared_state').upsert({
      key: CONNECTION_LOGS_KEY,
      payload: [],
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Silencieux
  }
}

let latestOnlineUsers: OnlineUserPresence[] = [];
const onlineListeners = new Set<(users: OnlineUserPresence[]) => void>();

export function onOnlineUsersChange(
  listener: (users: OnlineUserPresence[]) => void
): () => void {
  onlineListeners.add(listener);
  listener(latestOnlineUsers);
  return () => {
    onlineListeners.delete(listener);
  };
}

export function subscribePresence(profile: Profile): () => void {
  if (!isSupabaseConfigured || !profile?.id) {
    return () => {};
  }

  const sessionKey = `${profile.id}-${detectDeviceType()}-${Math.random().toString(36).slice(2, 8)}`;
  const myPresence: OnlineUserPresence = {
    sessionKey,
    userId: profile.id,
    fullName: `${profile.first_name} ${profile.last_name}`.trim(),
    email: profile.email,
    role: profile.role,
    device: detectDeviceType(),
    connectedAt: new Date().toISOString(),
  };

  try {
    const channel = supabase.channel('cmn-live-presence', {
      config: { presence: { key: sessionKey } },
    });

    const emitState = (): void => {
      const state = channel.presenceState<OnlineUserPresence>();
      const flattened: OnlineUserPresence[] = [];
      for (const entries of Object.values(state)) {
        if (Array.isArray(entries) && entries.length > 0) {
          flattened.push(entries[0]);
        }
      }
      flattened.sort((a, b) => b.connectedAt.localeCompare(a.connectedAt));
      latestOnlineUsers = flattened;
      for (const listener of onlineListeners) {
        listener(flattened);
      }
    };

    channel
      .on('presence', { event: 'sync' }, emitState)
      .on('presence', { event: 'join' }, emitState)
      .on('presence', { event: 'leave' }, emitState)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track(myPresence);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}
