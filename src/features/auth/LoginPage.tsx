import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useAdminStore } from '@/features/admin/AdminStoreContext';
import type { AuditLog, UserRole } from '@/domain/types';
import { USER_ROLE_LABELS } from '@/domain/types';
import { APP_VERSION } from '@/domain/referentials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Lock,
  UserCheck,
  Eye,
  EyeOff,
  UserPlus,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

const ROLES_LIST: UserRole[] = [
  'ADMIN_DTF',
  'MN_EVALUATOR',
  'CMN_CANDIDATE',
];

type AuthViewMode = 'SIGN_IN' | 'SIGN_UP' | 'FORGOT_PASSWORD';

export function LoginPage(): React.ReactElement {
  const {
    signInWithPassword,
    signUpNewUser,
    requestPasswordReset,
    switchDemoRole,
    error,
  } = useAuth();
  const { createCandidateProfile } = useAdminStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthViewMode>('SIGN_IN');

  // Champs Connexion & Réinitialisation
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Champs Inscription d'un nouvel utilisateur
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('CMN_CANDIDATE');
  const [regFebras, setRegFebras] = useState('');
  const [regGsm, setRegGsm] = useState('');
  const [regClub, setRegClub] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const switchMode = (nextMode: AuthViewMode): void => {
    setMode(nextMode);
    setLocalError(null);
    setInfoMessage(null);
  };

  const handleSignInSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLocalError(null);
    setInfoMessage(null);
    setSubmitting(true);
    const res = await signInWithPassword(email, password);
    setSubmitting(false);
    if (!res.error) {
      navigate('/tableau-de-bord');
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLocalError(null);
    setInfoMessage(null);

    if (password.length < 6) {
      setLocalError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (password !== regPasswordConfirm) {
      setLocalError('Les deux mots de passe saisis ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    const res = await signUpNewUser({
      email,
      password,
      first_name: regFirstName,
      last_name: regLastName,
      role: regRole,
      febras_number: regFebras,
      phone_gsm: regGsm,
      club_name: regClub,
    });
    setSubmitting(false);

    if (res.error) {
      setLocalError(res.error);
      return;
    }

    if (res.createdProfile) {
      const nowIso = new Date().toISOString();
      const auditLog: AuditLog = {
        id: `audit-signup-${Date.now()}`,
        actor_id: res.createdProfile.id,
        entity_type: 'profiles',
        entity_id: res.createdProfile.id,
        action: 'SELF_SIGNUP_PROFILE',
        previous_value: null,
        new_value: {
          name: `${res.createdProfile.first_name} ${res.createdProfile.last_name}`,
          role: res.createdProfile.role,
          email: res.createdProfile.email,
          febras_number: res.createdProfile.febras_number,
          club_name: res.createdProfile.club_name,
        },
        reason: `Inscription directe depuis la page d'accueil (${USER_ROLE_LABELS[res.createdProfile.role]})`,
        created_at: nowIso,
      };
      createCandidateProfile({
        candidateProfile: res.createdProfile,
        auditLog,
      });
    }

    if (res.requiresEmailConfirmation) {
      setInfoMessage(
        `Votre compte (${regFirstName} ${regLastName}) a bien été créé ! Vérifiez votre boîte e-mail (${email}) pour valider le lien d’activation, puis connectez-vous.`
      );
      setMode('SIGN_IN');
    } else {
      navigate('/tableau-de-bord');
    }
  };

  const handleForgotPasswordSubmit = async (
    e: React.FormEvent
  ): Promise<void> => {
    e.preventDefault();
    setLocalError(null);
    setInfoMessage(null);

    if (!email.trim()) {
      setLocalError(
        'Veuillez saisir votre adresse e-mail officielle pour recevoir le lien de réinitialisation.'
      );
      return;
    }

    setSubmitting(true);
    const res = await requestPasswordReset(email);
    setSubmitting(false);

    if (!res.error) {
      setInfoMessage(
        `Un e-mail de réinitialisation du mot de passe a été envoyé à l’adresse ${email}. Vérifiez votre boîte de réception (et vos courriers indésirables).`
      );
    }
  };

  const handleDemoLogin = (role: UserRole): void => {
    switchDemoRole(role);
    navigate('/tableau-de-bord');
  };

  const displayedError = localError ?? error;

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 p-4 sm:p-8">
      <div className="mx-auto w-full max-w-4xl grid gap-6 md:grid-cols-2">
        {/* Colonne Authentification, Inscription & Mot de passe oublié */}
        <Card className="border-slate-700/60 bg-white/95 backdrop-blur">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-sky-700">
              <div className="flex items-center gap-2.5">
                <img
                  src="/logo-lifras.jpg"
                  alt="Logo Officiel LIFRAS"
                  className="h-9 w-9 rounded-full object-cover shadow-sm"
                />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Commission de l’Enseignement — LIFRAS
                </span>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {APP_VERSION}
              </Badge>
            </div>
            <CardTitle className="text-2xl text-slate-900">
              Carnet de Bord Digital CMN
            </CardTitle>
            <CardDescription>
              {mode === 'SIGN_IN' &&
                'Portail officiel sécurisé de suivi du cursus Candidat Moniteur National.'}
              {mode === 'SIGN_UP' &&
                'Création d’un nouveau compte dans le système (Candidat CMN ou Moniteur National).'}
              {mode === 'FORGOT_PASSWORD' &&
                'Réinitialisation sécurisée de votre mot de passe par e-mail.'}
            </CardDescription>

            {/* Onglets rapides Se connecter / S'inscrire */}
            <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1 pt-1">
              <button
                type="button"
                onClick={() => switchMode('SIGN_IN')}
                className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold transition ${
                  mode === 'SIGN_IN'
                    ? 'bg-white text-sky-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Se connecter</span>
              </button>
              <button
                type="button"
                onClick={() => switchMode('SIGN_UP')}
                className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold transition ${
                  mode === 'SIGN_UP'
                    ? 'bg-white text-sky-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>S’inscrire (Nouveau)</span>
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {infoMessage && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{infoMessage}</span>
              </div>
            )}

            {displayedError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {displayedError}
              </div>
            )}

            {/* 1. MODE CONNEXION */}
            {mode === 'SIGN_IN' && (
              <form onSubmit={(e) => void handleSignInSubmit(e)} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-slate-700"
                  >
                    Adresse e-mail officielle
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="prenom.nom@lifras.be"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-sm font-medium text-slate-700"
                    >
                      Mot de passe
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode('FORGOT_PASSWORD')}
                      className="text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      title={
                        showPassword
                          ? 'Masquer le mot de passe'
                          : 'Afficher le mot de passe'
                      }
                      aria-label={
                        showPassword
                          ? 'Masquer le mot de passe'
                          : 'Afficher le mot de passe'
                      }
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-800"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  <Lock className="h-4 w-4" />
                  {submitting ? 'Connexion en cours...' : 'Se connecter'}
                </Button>

                <div className="pt-1 text-center text-xs text-slate-600">
                  Pas encore inscrit dans le système ?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('SIGN_UP')}
                    className="font-bold text-sky-700 hover:underline"
                  >
                    Créer mon compte
                  </button>
                </div>
              </form>
            )}

            {/* 2. MODE INSCRIPTION (NOUVEL UTILISATEUR) */}
            {mode === 'SIGN_UP' && (
              <form onSubmit={(e) => void handleSignUpSubmit(e)} className="space-y-3">
                <div>
                  <label
                    htmlFor="reg-role"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Profil souhaité *
                  </label>
                  <select
                    id="reg-role"
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="mt-1 flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
                  >
                    <option value="CMN_CANDIDATE">
                      {USER_ROLE_LABELS.CMN_CANDIDATE}
                    </option>
                    <option value="MN_EVALUATOR">
                      {USER_ROLE_LABELS.MN_EVALUATOR}
                    </option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="reg-firstname"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Prénom *
                    </label>
                    <Input
                      id="reg-firstname"
                      placeholder="Ex: Sophie"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="reg-lastname"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Nom *
                    </label>
                    <Input
                      id="reg-lastname"
                      placeholder="Ex: Lejeune"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-email"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Adresse e-mail *
                  </label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="prenom.nom@lifras.be"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label
                      htmlFor="reg-febras"
                      className="text-xs font-semibold text-slate-700"
                    >
                      N° FEBRAS *
                    </label>
                    <Input
                      id="reg-febras"
                      placeholder="0054321"
                      value={regFebras}
                      onChange={(e) => setRegFebras(e.target.value)}
                      className="font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="reg-gsm"
                      className="text-xs font-semibold text-slate-700"
                    >
                      GSM *
                    </label>
                    <Input
                      id="reg-gsm"
                      placeholder="0475123456"
                      value={regGsm}
                      onChange={(e) => setRegGsm(e.target.value)}
                      className="font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="reg-club"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Club LIFRAS *
                    </label>
                    <Input
                      id="reg-club"
                      placeholder="CAS Liège"
                      value={regClub}
                      onChange={(e) => setRegClub(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="reg-password"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Mot de passe *
                    </label>
                    <div className="relative mt-1">
                      <Input
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min. 6 caractères"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-9"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        title={
                          showPassword
                            ? 'Masquer le mot de passe'
                            : 'Afficher le mot de passe'
                        }
                        aria-label="Afficher ou masquer le mot de passe"
                        className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-500 hover:text-slate-800"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-password-confirm"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Confirmer *
                    </label>
                    <div className="relative mt-1">
                      <Input
                        id="reg-password-confirm"
                        type={showPasswordConfirm ? 'text' : 'password'}
                        placeholder="Répéter le mot de passe"
                        value={regPasswordConfirm}
                        onChange={(e) => setRegPasswordConfirm(e.target.value)}
                        className="pr-9"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm((prev) => !prev)}
                        title={
                          showPasswordConfirm
                            ? 'Masquer la confirmation'
                            : 'Afficher la confirmation'
                        }
                        aria-label="Afficher ou masquer la confirmation du mot de passe"
                        className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-500 hover:text-slate-800"
                      >
                        {showPasswordConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={submitting}
                >
                  <UserPlus className="h-4 w-4" />
                  {submitting
                    ? 'Création du compte...'
                    : 'S’inscrire et créer mon profil'}
                </Button>
              </form>
            )}

            {/* 3. MODE MOT DE PASSE OUBLIE */}
            {mode === 'FORGOT_PASSWORD' && (
              <form
                onSubmit={(e) => void handleForgotPasswordSubmit(e)}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label
                    htmlFor="reset-email"
                    className="text-sm font-medium text-slate-700"
                  >
                    Votre adresse e-mail officielle
                  </label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="prenom.nom@lifras.be"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  <KeyRound className="h-4 w-4" />
                  {submitting
                    ? 'Envoi en cours...'
                    : 'Envoyer le lien de réinitialisation'}
                </Button>

                <button
                  type="button"
                  onClick={() => switchMode('SIGN_IN')}
                  className="flex w-full items-center justify-center gap-1.5 pt-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Retour à la connexion</span>
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Colonne Simulateur des 3 Rôles Réglementaires */}
        <Card className="border-sky-800/40 bg-slate-900/90 text-slate-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="bg-sky-500/20 text-sky-300">
                Contrôle RBAC & RLS
              </Badge>
              <ShieldCheck className="h-5 w-5 text-sky-400" />
            </div>
            <CardTitle className="text-lg text-white">
              Accès rapide par Rôle Réglementaire
            </CardTitle>
            <CardDescription className="text-slate-300">
              Testez immédiatement le layout protégé et le cloisonnement des 3 rôles
              du cursus Candidat Moniteur National.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ROLES_LIST.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => handleDemoLogin(role)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800/70 px-4 py-3 text-left transition hover:border-sky-400 hover:bg-slate-800"
              >
                <div>
                  <div className="text-sm font-semibold text-white">
                    {USER_ROLE_LABELS[role]}
                  </div>
                </div>
                <UserCheck className="h-4 w-4 text-sky-400" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
