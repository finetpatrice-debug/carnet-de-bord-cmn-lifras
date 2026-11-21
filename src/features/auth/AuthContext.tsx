import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/services/supabaseClient';
import {
  findAuthorizedProfileByEmail,
  loadSavedAuthorizedSession,
  saveAuthorizedSession,
  setAuthorizedPassword,
  verifyAuthorizedPassword,
} from '@/services/authorizedAccessService';
import type { Profile, UserRole } from '@/domain/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  isDemoMode: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  activateAuthorizedAccess: (
    email: string,
    password: string
  ) => Promise<{
    error: string | null;
    activatedProfile: Profile | null;
  }>;
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
      } else {
        // Restaurer la session d'un membre pré-autorisé (connexion sans e-mail)
        const saved = loadSavedAuthorizedSession();
        if (saved) {
          const fresh = await findAuthorizedProfileByEmail(saved.email);
          if (fresh && mounted) {
            setProfile(fresh);
            saveAuthorizedSession(fresh);
            setIsDemoMode(false);
          } else if (mounted) {
            saveAuthorizedSession(null);
          }
        }
      }
      if (mounted) setLoading(false);
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
    const trimmedEmail = email.trim();

    // 1. Vérification prioritaire dans le registre des membres pré-autorisés (zéro e-mail)
    const authorizedProfile = await findAuthorizedProfileByEmail(trimmedEmail);
    if (authorizedProfile) {
      const check = await verifyAuthorizedPassword(trimmedEmail, password);
      if (check === 'OK') {
        setProfile(authorizedProfile);
        saveAuthorizedSession(authorizedProfile);
        setIsDemoMode(false);
        setError(null);
        return { error: null };
      }
      if (check === 'WRONG_PASSWORD') {
        const msg =
          'Mot de passe incorrect. En cas d’oubli, demandez à un administrateur LIFRAS de réinitialiser votre mot de passe.';
        setError(msg);
        return { error: msg };
      }
      // check === 'NO_PASSWORD_SET' : on teste silencieusement Supabase Auth au cas où un ancien compte existe déjà (n'envoie jamais d'e-mail)
      if (isSupabaseConfigured) {
        const { data: sbData, error: sbErr } =
          await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });
        if (!sbErr && sbData.user) {
          await fetchProfile(
            sbData.user.id,
            sbData.user.email,
            sbData.user.user_metadata
          );
          setIsDemoMode(false);
          return { error: null };
        }
      }
      const noPwdMsg =
        'Votre adresse e-mail est bien autorisée, mais votre mot de passe n’a pas encore été défini. Cliquez sur « 1ère connexion (Activer mon accès) » pour choisir votre mot de passe.';
      setError(noPwdMsg);
      return { error: noPwdMsg };
    }

    // 2. Comptes administrateurs/concepteur déjà existants dans Supabase Auth (ex. patricefinet@lifras.be) — n'envoie jamais d'e-mail
    if (isSupabaseConfigured) {
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

      if (!signInError && signInData.user) {
        await fetchProfile(
          signInData.user.id,
          signInData.user.email,
          signInData.user.user_metadata
        );
        setIsDemoMode(false);
        return { error: null };
      }
    }

    // 3. Adresse inconnue / non pré-enregistrée : accès refusé
    const deniedMsg =
      'Accès refusé : cette adresse e-mail n’est pas pré-enregistrée dans la liste des membres autorisés (ou mot de passe incorrect). Contactez un administrateur LIFRAS.';
    setError(deniedMsg);
    return { error: deniedMsg };
  };

  const activateAuthorizedAccess = async (
    email: string,
    password: string
  ): Promise<{
    error: string | null;
    activatedProfile: Profile | null;
  }> => {
    setError(null);
    const trimmedEmail = email.trim();

    // 1. Vérifier que l'adresse e-mail est bien pré-enregistrée par un administrateur
    const authorizedProfile = await findAuthorizedProfileByEmail(trimmedEmail);
    if (!authorizedProfile) {
      const msg =
        'Accès refusé : cette adresse e-mail n’est pas pré-enregistrée dans la liste des membres autorisés. Seul un administrateur LIFRAS peut ajouter votre adresse.';
      setError(msg);
      return { error: msg, activatedProfile: null };
    }

    // 2. Empêcher l'écrasement d'un mot de passe déjà défini par le titulaire
    const existingStatus = await verifyAuthorizedPassword(trimmedEmail, password);
    if (existingStatus !== 'NO_PASSWORD_SET') {
      const msg =
        'Cet accès dispose déjà d’un mot de passe. Utilisez l’onglet « Se connecter » ou demandez à un administrateur de réinitialiser votre mot de passe.';
      setError(msg);
      return { error: msg, activatedProfile: null };
    }

    // 3. Enregistrer le mot de passe haché (SHA-256) dans Supabase sans aucun envoi d'e-mail
    await setAuthorizedPassword(trimmedEmail, authorizedProfile.id, password);
    setProfile(authorizedProfile);
    saveAuthorizedSession(authorizedProfile);
    setIsDemoMode(false);
    setError(null);

    return {
      error: null,
      activatedProfile: authorizedProfile,
    };
  };

  const signOut = async (): Promise<void> => {
    saveAuthorizedSession(null);
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
    saveAuthorizedSession(null);
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
        activateAuthorizedAccess,
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
