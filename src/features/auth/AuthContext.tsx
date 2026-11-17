import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/services/supabaseClient';
import type { Profile, UserRole } from '@/domain/types';

interface SignUpPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  febras_number: string;
  phone_gsm: string;
  club_name: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  isDemoMode: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpNewUser: (payload: SignUpPayload) => Promise<{
    error: string | null;
    createdProfile: Profile | null;
    requiresEmailConfirmation: boolean;
  }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  switchDemoRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_PROFILES: Record<UserRole, Profile> = {
  ADMIN_DTF: {
    id: '00000000-0000-0000-0000-000000000001',
    role: 'ADMIN_DTF',
    cohort_id: '00000000-0000-0000-0000-000000000100',
    sponsor_mn_id: null,
    last_name: 'Direction',
    first_name: 'DTF LIFRAS',
    birth_date: '1975-04-12',
    street_address: 'Avenue de la Plongée 1',
    postal_code: '1000',
    city: 'Bruxelles',
    phone_landline: null,
    phone_gsm: '0470123456',
    email: 'dtf@lifras.be',
    febras_number: '0012345',
    cfps_year: 2005,
    mf_year: 2008,
    dives_count: 1850,
    club_name: 'CE LIFRAS',
    club_president: null,
    club_head_instructor: null,
    club_head_gsm: null,
    photo_storage_path: null,
    aliases: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  MN_EVALUATOR: {
    id: '00000000-0000-0000-0000-000000000002',
    role: 'MN_EVALUATOR',
    cohort_id: '00000000-0000-0000-0000-000000000100',
    sponsor_mn_id: null,
    last_name: 'Lambert',
    first_name: 'Jean-Marc',
    birth_date: '1978-09-21',
    street_address: 'Rue du Récif 14',
    postal_code: '4000',
    city: 'Liège',
    phone_landline: null,
    phone_gsm: '0475987654',
    email: 'jm.lambert@lifras.be',
    febras_number: '0023456',
    cfps_year: 2008,
    mf_year: 2011,
    dives_count: 1420,
    club_name: 'CAS Liège',
    club_president: null,
    club_head_instructor: null,
    club_head_gsm: null,
    photo_storage_path: null,
    aliases: ['J-M Lambert'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  CMN_CANDIDATE: {
    id: '00000000-0000-0000-0000-000000000004',
    role: 'CMN_CANDIDATE',
    cohort_id: '00000000-0000-0000-0000-000000000100',
    sponsor_mn_id: null,
    last_name: 'Peeters',
    first_name: 'Thomas',
    birth_date: '1988-06-30',
    street_address: 'Rue de la Zélande 42',
    postal_code: '1300',
    city: 'Wavre',
    phone_landline: null,
    phone_gsm: '0479445566',
    email: 'thomas.peeters@lifras.be',
    febras_number: '0054321',
    cfps_year: 2018,
    mf_year: 2021,
    dives_count: 640,
    club_name: 'Nautilus Club',
    club_president: 'Marc Vandevelde',
    club_head_instructor: 'Luc Moreau',
    club_head_gsm: '0471009988',
    photo_storage_path: null,
    aliases: ['Peeters Thomas'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!isSupabaseConfigured);

  const fetchProfile = async (
    userId: string,
    userEmail?: string,
    userMeta?: Record<string, unknown>
  ): Promise<void> => {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data && !profileError) {
      setProfile(data as Profile);
      setError(null);
      return;
    }

    // Repli automatique si la politique SELECT RLS sur profiles ou la ligne profiles n'est pas encore créée
    const emailLower = (userEmail ?? '').toLowerCase();
    const isMainAdmin =
      emailLower.includes('finet') ||
      emailLower.includes('fune') ||
      emailLower.includes('dtf');

    const metaRole =
      typeof userMeta?.role === 'string' &&
      (userMeta.role === 'ADMIN_DTF' ||
        userMeta.role === 'MN_EVALUATOR' ||
        userMeta.role === 'CMN_CANDIDATE')
        ? (userMeta.role as UserRole)
        : isMainAdmin
          ? 'ADMIN_DTF'
          : 'CMN_CANDIDATE';

    setProfile({
      ...DEMO_PROFILES[metaRole],
      id: userId,
      role: metaRole,
      last_name:
        typeof userMeta?.last_name === 'string' && userMeta.last_name
          ? userMeta.last_name
          : isMainAdmin
            ? 'Finet'
            : 'Utilisateur',
      first_name:
        typeof userMeta?.first_name === 'string' && userMeta.first_name
          ? userMeta.first_name
          : isMainAdmin
            ? 'Patrice'
            : 'LIFRAS',
      email: userEmail ?? 'patrice.finet@lifras.be',
      febras_number:
        typeof userMeta?.febras_number === 'string'
          ? userMeta.febras_number
          : DEMO_PROFILES[metaRole].febras_number,
      phone_gsm:
        typeof userMeta?.phone_gsm === 'string'
          ? userMeta.phone_gsm
          : DEMO_PROFILES[metaRole].phone_gsm,
      club_name:
        typeof userMeta?.club_name === 'string'
          ? userMeta.club_name
          : DEMO_PROFILES[metaRole].club_name,
    });
    setError(null);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: activeSession } }) => {
      if (!mounted) return;
      setSession(activeSession);
      setUser(activeSession?.user ?? null);
      if (activeSession?.user) {
        await fetchProfile(
          activeSession.user.id,
          activeSession.user.email,
          activeSession.user.user_metadata
        );
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        await fetchProfile(
          newSession.user.id,
          newSession.user.email,
          newSession.user.user_metadata
        );
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    setError(null);
    if (!isSupabaseConfigured) {
      return {
        error:
          'Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY non définies. Utilisez le sélecteur de rôle de démonstration ou configurez votre fichier .env.',
      };
    }

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError) {
      setError(signInError.message);
      return { error: signInError.message };
    }

    if (signInData.user) {
      await fetchProfile(
        signInData.user.id,
        signInData.user.email,
        signInData.user.user_metadata
      );
    }

    setIsDemoMode(false);
    return { error: null };
  };

  const signUpNewUser = async (
    payload: SignUpPayload
  ): Promise<{
    error: string | null;
    createdProfile: Profile | null;
    requiresEmailConfirmation: boolean;
  }> => {
    setError(null);
    const nowIso = new Date().toISOString();

    const buildNewProfile = (id: string): Profile => ({
      id,
      role: payload.role,
      cohort_id: 'cohort-2026',
      sponsor_mn_id: null,
      last_name: payload.last_name.trim(),
      first_name: payload.first_name.trim(),
      birth_date: null,
      street_address: null,
      postal_code: null,
      city: null,
      phone_landline: null,
      phone_gsm: payload.phone_gsm.trim() || null,
      email: payload.email.trim(),
      febras_number: payload.febras_number.trim() || null,
      cfps_year: null,
      mf_year: null,
      dives_count: 0,
      club_name: payload.club_name.trim() || null,
      club_president: null,
      club_head_instructor: null,
      club_head_gsm: null,
      photo_storage_path: null,
      aliases: [`${payload.last_name.trim()} ${payload.first_name.trim()}`],
      created_at: nowIso,
      updated_at: nowIso,
    });

    if (!isSupabaseConfigured) {
      const localProfile = buildNewProfile(`user-${Date.now()}`);
      setIsDemoMode(true);
      setProfile(localProfile);
      return {
        error: null,
        createdProfile: localProfile,
        requiresEmailConfirmation: false,
      };
    }

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: payload.email.trim(),
      password: payload.password,
      options: {
        data: {
          first_name: payload.first_name.trim(),
          last_name: payload.last_name.trim(),
          role: payload.role,
          febras_number: payload.febras_number.trim(),
          phone_gsm: payload.phone_gsm.trim(),
          club_name: payload.club_name.trim(),
        },
      },
    });

    if (signUpErr) {
      setError(signUpErr.message);
      return {
        error: signUpErr.message,
        createdProfile: null,
        requiresEmailConfirmation: false,
      };
    }

    const userId = data.user?.id ?? `user-${Date.now()}`;
    const createdProfile = buildNewProfile(userId);

    // Tentative d'enregistrement direct dans public.profiles si la session est ouverte
    try {
      await supabase.from('profiles').upsert({
        id: createdProfile.id,
        role: createdProfile.role,
        last_name: createdProfile.last_name,
        first_name: createdProfile.first_name,
        email: createdProfile.email,
        febras_number: createdProfile.febras_number,
        phone_gsm: createdProfile.phone_gsm,
        club_name: createdProfile.club_name,
        aliases: createdProfile.aliases,
      });
    } catch {
      // Ignorer si RLS bloque l'insertion directe avant confirmation e-mail
    }

    const hasActiveSession = Boolean(data.session);
    if (hasActiveSession) {
      setProfile(createdProfile);
      setIsDemoMode(false);
    }

    return {
      error: null,
      createdProfile,
      requiresEmailConfirmation: !hasActiveSession,
    };
  };

  const requestPasswordReset = async (
    email: string
  ): Promise<{ error: string | null }> => {
    setError(null);
    if (!isSupabaseConfigured) {
      return { error: null };
    }
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/connexion`
        : 'https://carnet-de-bord-cmn.web.app/connexion';
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo }
    );
    if (resetErr) {
      setError(resetErr.message);
      return { error: resetErr.message };
    }
    return { error: null };
  };

  const signOut = async (): Promise<void> => {
    if (isDemoMode) {
      setProfile(null);
      return;
    }
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setUser(null);
  };

  const switchDemoRole = (role: UserRole): void => {
    setIsDemoMode(true);
    setError(null);
    setProfile(DEMO_PROFILES[role]);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        error,
        isDemoMode,
        signInWithPassword,
        signUpNewUser,
        requestPasswordReset,
        signOut,
        switchDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé au sein d’un AuthProvider.');
  }
  return ctx;
}
