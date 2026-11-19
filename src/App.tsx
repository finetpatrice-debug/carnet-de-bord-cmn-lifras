import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthContext';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedLayout } from '@/features/auth/ProtectedLayout';
import { RoleProtectedRoute } from '@/features/auth/RoleProtectedRoute';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { EvaluationPage } from '@/features/evaluation/EvaluationPage';
import { ImportPage } from '@/features/import/ImportPage';
import { AdminPage } from '@/features/admin/AdminPage';
import { AdminStoreProvider } from '@/features/admin/AdminStoreContext';

export function App(): React.ReactElement {
  // Passage automatique en plein écran sur smartphone dès la première interaction tactile
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const isMobileViewport =
      window.matchMedia('(max-width: 767px)').matches ||
      window.matchMedia('(pointer: coarse)').matches;
    const isAlreadyStandalone =
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: standalone)').matches;

    if (!isMobileViewport || isAlreadyStandalone) return;
    if (typeof document.documentElement.requestFullscreen !== 'function') return;

    const handleFirstMobileTap = (event: MouseEvent): void => {
      if (sessionStorage.getItem('cmn_fs_dismissed') === '1') return;
      if (document.fullscreenElement) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        ['INPUT', 'TEXTAREA', 'SELECT', 'OPTION'].includes(target.tagName)
      ) {
        return;
      }
      document.documentElement
        .requestFullscreen({ navigationUI: 'hide' })
        .catch(() => {
          // Ignorer si refusé par le navigateur (ex. iOS Safari hors PWA installée)
        });
      window.removeEventListener('click', handleFirstMobileTap, true);
    };

    window.addEventListener('click', handleFirstMobileTap, true);
    return () => {
      window.removeEventListener('click', handleFirstMobileTap, true);
    };
  }, []);

  return (
    <AuthProvider>
      <AdminStoreProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/connexion" element={<LoginPage />} />

          <Route element={<ProtectedLayout />}>
            {/* Accessible aux 3 rôles réglementaires */}
            <Route
              element={
                <RoleProtectedRoute
                  allowedRoles={[
                    'ADMIN_DTF',
                    'MN_EVALUATOR',
                    'CMN_CANDIDATE',
                  ]}
                />
              }
            >
              <Route path="/tableau-de-bord" element={<DashboardPage />} />
            </Route>

            {/* Réservé aux évaluateurs MN et administrateurs DTF */}
            <Route
              element={
                <RoleProtectedRoute
                  allowedRoles={['ADMIN_DTF', 'MN_EVALUATOR']}
                />
              }
            >
              <Route path="/evaluations" element={<EvaluationPage />} />
            </Route>

            {/* Réservé exclusivement aux administrateurs DTF */}
            <Route
              element={<RoleProtectedRoute allowedRoles={['ADMIN_DTF']} />}
            >
              <Route path="/import-excel" element={<ImportPage />} />
              <Route path="/administration" element={<AdminPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/tableau-de-bord" replace />} />
        </Routes>
      </BrowserRouter>
      </AdminStoreProvider>
    </AuthProvider>
  );
}

export default App;
