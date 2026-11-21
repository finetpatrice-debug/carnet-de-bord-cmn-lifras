import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { UserRole } from '@/domain/types';
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
  KeyRound,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

const ROLES_LIST: UserRole[] = [
  'ADMIN_DTF',
  'MN_EVALUATOR',
  'CMN_CANDIDATE',
];

type AuthViewMode = 'SIGN_IN' | 'FIRST_ACCESS' | 'FORGOT_PASSWORD';

export function LoginPage(): React.ReactElement {
  const {
    signInWithPassword,
    activateAuthorizedAccess,
    switchDemoRole,
    error,
  } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthViewMode>('SIGN_IN');

  // Champs Connexion & Activation 1ère connexion
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState('');
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
      if (res.role === 'CMN_CANDIDATE') {
        navigate('/tableau-de-bord');
      } else {
        navigate('/evaluations');
      }
    }
  };

  const handleFirstAccessSubmit = async (
    e: React.FormEvent
  ): Promise<void> => {
    e.preventDefault();
    setLocalError(null);
    setInfoMessage(null);

    if (password.length < 6) {
      setLocalError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (password !== passwordConfirm) {
      setLocalError('Les deux mots de passe saisis ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    const res = await activateAuthorizedAccess(email, password);
    setSubmitting(false);

    if (res.error) {
      setLocalError(res.error);
      return;
    }

    if (res.activatedProfile?.role === 'CMN_CANDIDATE') {
      navigate('/tableau-de-bord');
    } else {
      navigate('/evaluations');
    }
  };

  const handleDemoLogin = (role: UserRole): void => {
    switchDemoRole(role);
    if (role === 'CMN_CANDIDATE') {
      navigate('/tableau-de-bord');
    } else {
      navigate('/evaluations');
    }
  };

  const displayedError = localError ?? error;

  return (
    <div className="relative flex min-h-[100dvh] flex-col justify-between overflow-x-hidden bg-slate-950 p-3 sm:p-5 md:px-10 md:py-4 lg:px-14">
      {/* 1. PC & Tablette (md+) : Vidéo officielle en fond d'écran plein cadre en boucle fluide (avec photo poster immédiate) */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/Cover Carnet de Bord light.jpg?v=2.0.0-cover2"
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 hidden md:block h-full w-full object-cover object-right"
      >
        <source src="/accueil-cmn-video.mp4?v=2.0.6" type="video/mp4" />
      </video>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 hidden md:block bg-gradient-to-r from-slate-950/60 via-slate-950/20 to-transparent"
      />

      {/* 2. GSM (< md) : Fond sombre dégradé neutre + Bandeau photo dédié en haut */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 md:hidden bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950"
      />

      {/* En-tête agrandi, remonté tout en haut sur PC (md+) et aligné verticalement pile au-dessus du bloc Connexion & Inscription */}
      <div className="relative z-10 hidden md:flex md:ml-[6%] lg:ml-[9%] xl:ml-[11%] w-full max-w-md lg:max-w-[440px] items-center gap-3.5 pt-1">
        <img
          src="/logo-lifras.jpg"
          alt="Logo Officiel LIFRAS"
          className="h-16 w-16 shrink-0 rounded-full border-2 border-sky-400 bg-white object-cover shadow-xl"
        />
        <div className="min-w-0">
          <div className="whitespace-nowrap text-xs font-extrabold uppercase tracking-wider text-sky-300 drop-shadow">
            Commission de l’Enseignement — LIFRAS
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="whitespace-nowrap text-xl lg:text-2xl font-extrabold leading-tight tracking-tight text-white drop-shadow-md">
              Carnet de Bord Digital CMN
            </h1>
            <Badge className="shrink-0 border border-emerald-400/60 bg-slate-950/75 font-mono text-xs text-emerald-200 backdrop-blur-md">
              {APP_VERSION}
            </Badge>
          </div>
        </div>
      </div>

      {/* Conteneur principal : centré sur GSM, recentré verticalement (entre le haut et le bas) et équilibré entre bord gauche et plongeur sur PC */}
      <div className="relative z-10 mx-auto md:mx-0 md:my-auto md:ml-[6%] lg:ml-[9%] xl:ml-[11%] w-full max-w-md lg:max-w-[440px] space-y-2.5 md:space-y-3 py-2">
        {/* Bandeau vidéo affiché UNIQUEMENT sur GSM (< md), en boucle silencieuse avec poster immédiat — agrandi pour mieux mettre en valeur la vidéo */}
        <div className="relative overflow-hidden rounded-xl border border-sky-400/30 shadow-xl md:hidden">
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            poster="/Cover Carnet de Bord light.jpg?v=2.0.0-cover2"
            aria-label="Moniteur National LIFRAS face à la mer — Carnet de Bord Digital CMN"
            className="h-56 sm:h-64 w-full object-cover object-[65%_22%]"
          >
            <source src="/accueil-cmn-video.mp4?v=2.0.6" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 px-3 py-3">
            <img
              src="/logo-lifras.jpg"
              alt="Logo Officiel LIFRAS"
              className="h-12 w-12 shrink-0 rounded-full border-2 border-sky-400 bg-white object-cover shadow-lg"
            />
            <div className="min-w-0 text-center">
              <div className="text-[11px] leading-snug font-extrabold uppercase tracking-wide text-sky-300 drop-shadow">
                Commission de l’Enseignement — LIFRAS
              </div>
              <h1 className="text-base sm:text-lg leading-tight font-extrabold tracking-tight text-white drop-shadow-md">
                Carnet de Bord Digital CMN
              </h1>
            </div>
          </div>
        </div>

        {/* Empilement vertical (Connexion & Inscription en haut, Accès rapide juste en dessous) — légèrement abaissé sur GSM pour laisser respirer la vidéo */}
        <div className="flex flex-col gap-2.5 pt-2 md:pt-0 md:gap-3">
          {/* Carte 1 : Authentification, Inscription & Mot de passe oublié — fond blanc net et écritures à haut contraste */}
          <Card className="border-slate-200 bg-white shadow-2xl">
            <CardHeader className="space-y-1 p-3.5 pb-1.5">
              <CardTitle className="text-base font-extrabold text-slate-950">
                Accès Sécurisé LIFRAS
              </CardTitle>
              <CardDescription className="text-xs font-medium text-slate-700">
              {mode === 'SIGN_IN' &&
                'Réservé aux membres pré-enregistrés par l’administrateur LIFRAS.'}
              {mode === 'FIRST_ACCESS' &&
                'Saisissez votre adresse e-mail pré-enregistrée et choisissez votre mot de passe (sans e-mail de confirmation).'}
              {mode === 'FORGOT_PASSWORD' &&
                'Réinitialisation sécurisée sans envoi d’e-mail.'}
            </CardDescription>

            {/* Onglets rapides Se connecter / 1ère connexion */}
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/80 p-1">
              <button
                type="button"
                onClick={() => switchMode('SIGN_IN')}
                className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold transition ${
                  mode === 'SIGN_IN'
                    ? 'bg-sky-700 text-white shadow-sm'
                    : 'text-slate-800 hover:bg-white/70 hover:text-slate-950'
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Se connecter</span>
              </button>
              <button
                type="button"
                onClick={() => switchMode('FIRST_ACCESS')}
                className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold transition ${
                  mode === 'FIRST_ACCESS'
                    ? 'bg-sky-700 text-white shadow-sm'
                    : 'text-slate-800 hover:bg-white/70 hover:text-slate-950'
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>1ère connexion</span>
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 p-3.5 sm:p-4 pt-2">
            {infoMessage && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{infoMessage}</span>
              </div>
            )}

            {displayedError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {displayedError}
              </div>
            )}

            {/* 1. MODE CONNEXION */}
            {mode === 'SIGN_IN' && (
              <form onSubmit={(e) => void handleSignInSubmit(e)} className="space-y-3">
                <div className="space-y-1">
                  <label
                    htmlFor="email"
                    className="text-sm font-bold text-slate-900"
                  >
                    Adresse e-mail officielle
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="prenom.nom@lifras.be"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-slate-400 bg-white font-semibold text-slate-950 placeholder:text-slate-500 focus:border-sky-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-sm font-bold text-slate-900"
                    >
                      Mot de passe
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode('FORGOT_PASSWORD')}
                      className="text-xs font-bold text-sky-700 hover:text-sky-900 hover:underline"
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
                      className="border-slate-400 bg-white pr-10 font-semibold text-slate-950 placeholder:text-slate-500 focus:border-sky-600"
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
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-700 hover:text-slate-950"
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
                  Première visite avec votre e-mail pré-enregistré ?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('FIRST_ACCESS')}
                    className="font-bold text-sky-700 hover:underline"
                  >
                    Activer mon accès
                  </button>
                </div>
              </form>
            )}

            {/* 2. MODE 1ÈRE CONNEXION (MEMBRE PRÉ-ENREGISTRÉ UNIQUEMENT, SANS E-MAIL) */}
            {mode === 'FIRST_ACCESS' && (
              <form
                onSubmit={(e) => void handleFirstAccessSubmit(e)}
                className="space-y-3"
              >
                <div className="rounded-md border border-sky-200 bg-sky-50 p-2.5 text-[11px] text-sky-900">
                  Seules les adresses e-mail préalablement enregistrées par
                  l’administrateur LIFRAS peuvent activer un accès. Aucun e-mail
                  de confirmation n’est envoyé.
                </div>

                <div>
                  <label
                    htmlFor="first-email"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Votre adresse e-mail pré-enregistrée *
                  </label>
                  <Input
                    id="first-email"
                    type="email"
                    placeholder="prenom.nom@lifras.be"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 border-slate-400 bg-white font-semibold text-slate-950"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="first-password"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Choisir un mot de passe *
                    </label>
                    <div className="relative mt-1">
                      <Input
                        id="first-password"
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
                      htmlFor="first-password-confirm"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Confirmer *
                    </label>
                    <div className="relative mt-1">
                      <Input
                        id="first-password-confirm"
                        type={showPasswordConfirm ? 'text' : 'password'}
                        placeholder="Répéter le mot de passe"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
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
                  <KeyRound className="h-4 w-4" />
                  {submitting
                    ? 'Activation en cours...'
                    : 'Définir mon mot de passe et entrer'}
                </Button>
              </form>
            )}

            {/* 3. MODE MOT DE PASSE OUBLIE (ZERO E-MAIL — REINITIALISATION PAR ADMINISTRATEUR) */}
            {mode === 'FORGOT_PASSWORD' && (
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 space-y-1.5">
                  <div className="font-bold text-amber-900">
                    Réinitialisation gérée par un Administrateur LIFRAS
                  </div>
                  <p>
                    Par sécurité et sans envoi d’e-mail automatique, demandez à
                    un <strong>Administrateur</strong> de réinitialiser votre
                    accès (ou de vous attribuer un nouveau mot de passe) depuis
                    votre fiche profil.
                  </p>
                  <p>
                    Dès la réinitialisation effectuée, vous pourrez choisir un
                    nouveau mot de passe directement via l’onglet{' '}
                    <strong>« 1ère connexion »</strong>.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => switchMode('SIGN_IN')}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la connexion
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Carte 2 : Accès rapide par Rôle Réglementaire empilée juste en dessous */}
        <Card className="border-sky-400/30 bg-slate-950/75 text-slate-100 backdrop-blur-md shadow-2xl">
          <CardHeader className="space-y-0.5 p-3 pb-1.5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-white">
                Accès rapide par Rôle Réglementaire
              </CardTitle>
              <Badge variant="secondary" className="bg-sky-500/20 text-sky-300 text-[10px]">
                <ShieldCheck className="mr-1 h-3 w-3 text-sky-400" />
                RBAC & RLS
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5 p-3 pt-1">
            {ROLES_LIST.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => handleDemoLogin(role)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800/75 px-3 py-1.5 text-left transition hover:border-sky-400 hover:bg-slate-800"
              >
                <div>
                  <div className="text-xs font-semibold text-white">
                    {USER_ROLE_LABELS[role]}
                  </div>
                </div>
                <UserCheck className="h-3.5 w-3.5 text-sky-400" />
              </button>
            ))}
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Signature concepteur + badge de version tout en bas centré sur l'écran d'accueil GSM */}
      <div className="relative z-10 flex md:hidden items-center justify-center gap-2.5 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium tracking-wide text-slate-300">
            By
          </span>
          <img
            src="/logo-dtf.jpg?v=2.0.16"
            alt="Diving Technical Framework"
            className="h-8 w-auto rounded border border-sky-400/25 object-contain shadow-sm"
          />
        </div>
        <Badge className="shrink-0 border border-emerald-400/50 bg-slate-950/75 px-1.5 py-0.5 font-mono text-[10px] text-emerald-200 backdrop-blur-sm">
          {APP_VERSION}
        </Badge>
      </div>
    </div>
  );
}
