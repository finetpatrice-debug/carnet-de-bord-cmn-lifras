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
import { ShieldCheck, Lock, UserCheck } from 'lucide-react';

const ROLES_LIST: UserRole[] = [
  'ADMIN_DTF',
  'MN_EVALUATOR',
  'CMN_CANDIDATE',
];

export function LoginPage(): React.ReactElement {
  const { signInWithPassword, switchDemoRole, error } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    const res = await signInWithPassword(email, password);
    setSubmitting(false);
    if (!res.error) {
      navigate('/tableau-de-bord');
    }
  };

  const handleDemoLogin = (role: UserRole): void => {
    switchDemoRole(role);
    navigate('/tableau-de-bord');
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 p-4 sm:p-8">
      <div className="mx-auto w-full max-w-4xl grid gap-6 md:grid-cols-2">
        {/* Colonne Authentification Supabase */}
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
              Portail officiel sécurisé de suivi du cursus Candidat Moniteur National.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-700"
                >
                  Mot de passe
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                <Lock className="h-4 w-4" />
                {submitting ? 'Connexion en cours...' : 'Se connecter'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Colonne Simulateur des 4 Rôles Réglementaires */}
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
