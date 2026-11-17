import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { UserRole } from '@/domain/types';
import { USER_ROLE_LABELS } from '@/domain/types';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RoleProtectedRouteProps {
  allowedRoles: UserRole[];
}

export function RoleProtectedRoute({
  allowedRoles,
}: RoleProtectedRouteProps): React.ReactElement {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-700">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
        <p className="text-sm font-medium">Vérification des habilitations LIFRAS...</p>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/connexion" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(profile.role)) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <Card className="max-w-lg border-red-200 bg-white shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3 text-red-600">
              <ShieldAlert className="h-6 w-6" />
              <CardTitle>Accès restreint — Séparation stricte des rôles</CardTitle>
            </div>
            <CardDescription>
              Votre rôle actuel (
              <span className="font-semibold text-slate-800">
                {USER_ROLE_LABELS[profile.role]}
              </span>
              ) ne vous autorise pas à consulter ce module.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>
              Rôles requis pour cette section :{' '}
              {allowedRoles.map((r) => USER_ROLE_LABELS[r]).join(', ')}.
            </p>
            <Button asChild variant="outline">
              <a href="/tableau-de-bord">Retourner au Tableau de Bord</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}
