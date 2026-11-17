import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/services/supabaseClient';
import type { Profile, UserRole } from '@/domain/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  isDemoMode: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
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
    first_name: 'Jean-Marc (MN)',
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
  PARRAIN_MN: {
    id: '00000000-0000-0000-0000-000000000003',
    role: 'PARRAIN_MN',
    cohort_id: '00000000-0000-0000-0000-000000000100',
    sponsor_mn_id: null,
    last_name: 'Dubois',
    first_name: 'Claire (Parrain MN)',
    birth_date: '1980-02-18',
    street_address: 'Chaussée des Carrières 8',
    postal_code: '5000',
    city: 'Namur',
    phone_landline: null,
    phone_gsm: '0472112233',
    email: 'claire.dubois@lifras.be',
    febras_number: '0034567',
    cfps_year: 2010,
    mf_year: 2013,
    dives_count: 1150,
    club_name: 'Namur Plongée',
    club_president: null,
    club_head_instructor: null,
    club_head_gsm: null,
    photo_storage_path: null,
    aliases: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  CMN_CANDIDATE: {
    id: '00000000-0000-0000-0000-000000000004',
    role: 'CMN_CANDIDATE',
    cohort_id: '00000000-0000-0000-0000-000000000100',
    sponsor_mn_id: '00000000-0000-0000-0000-000000000003',
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
    userEmail?: string
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

    setProfile({
      ...DEMO_PROFILES[isMainAdmin ? 'ADMIN_DTF' : 'CMN_CANDIDATE'],
      id: userId,
      last_name: isMainAdmin ? 'Finet' : 'Utilisateur',
      first_name: isMainAdmin ? 'Patrice' : 'LIFRAS',
      email: userEmail ?? 'patrice.finet@lifras.be',
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
        await fetchProfile(activeSession.user.id, activeSession.user.email);
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
        await fetchProfile(newSession.user.id, newSession.user.email);
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
      await fetchProfile(signInData.user.id, signInData.user.email);
    }

    setIsDemoMode(false);
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
