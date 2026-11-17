import React from 'react';
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
