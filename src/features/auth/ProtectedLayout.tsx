import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from './AuthContext';
import { useAdminStore } from '@/features/admin/AdminStoreContext';
import {
  flushOutboxEvaluations,
  offlineDb,
  syncLocalReferentialsCache,
} from '@/services/offlineQueue';
import type { UserRole } from '@/domain/types';
import { USER_ROLE_LABELS } from '@/domain/types';
import { APP_VERSION } from '@/domain/referentials';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  LayoutDashboard,
  ClipboardCheck,
  FileSpreadsheet,
  Shield,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  QrCode,
  Copy,
  Check,
  X,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/tableau-de-bord',
    label: 'Tableau de Bord',
    icon: LayoutDashboard,
    allowedRoles: ['ADMIN_DTF', 'MN_EVALUATOR', 'PARRAIN_MN', 'CMN_CANDIDATE'],
  },
  {
    to: '/evaluations',
    label: 'Évaluation Terrain',
    icon: ClipboardCheck,
    allowedRoles: ['ADMIN_DTF', 'MN_EVALUATOR'],
  },
  {
    to: '/import-excel',
    label: 'Import Iso-Excel',
    icon: FileSpreadsheet,
    allowedRoles: ['ADMIN_DTF'],
  },
  {
    to: '/administration',
    label: 'Administration & Audit',
    icon: Shield,
    allowedRoles: ['ADMIN_DTF'],
  },
];

const ALL_ROLES: UserRole[] = [
  'ADMIN_DTF',
  'MN_EVALUATOR',
  'PARRAIN_MN',
  'CMN_CANDIDATE',
];

const PUBLIC_APP_URL = 'https://carnet-de-bord-cmn.web.app';

export function ProtectedLayout(): React.ReactElement {
  const { profile, isDemoMode, switchDemoRole, signOut } = useAuth();
  const { candidates, mnDirectory, recordFieldEvaluation } = useAdminStore();
  const navigate = useNavigate();

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isFlushing, setIsFlushing] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  const outboxCount =
    useLiveQuery(
      () => offlineDb.outbox_evaluations.count(),
      [],
      0
    ) ?? 0;

  useEffect(() => {
    void syncLocalReferentialsCache(candidates, mnDirectory);
  }, [candidates, mnDirectory]);

  useEffect(() => {
    const handleOnline = (): void => {
      setIsOnline(true);
      setIsFlushing(true);
      void flushOutboxEvaluations(recordFieldEvaluation).finally(() => {
        setIsFlushing(false);
      });
    };
    const handleOffline = (): void => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [recordFieldEvaluation]);

  const handleManualFlush = async (): Promise<void> => {
    setIsFlushing(true);
    try {
      await flushOutboxEvaluations(recordFieldEvaluation);
    } finally {
      setIsFlushing(false);
    }
  };

  if (!profile) {
    return <Outlet />;
  }

  const visibleNavItems = NAV_ITEMS.filter((item) =>
    item.allowedRoles.includes(profile.role)
  );

  const handleLogout = async (): Promise<void> => {
    await signOut();
    navigate('/connexion');
  };

  const handleCopyUrl = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(PUBLIC_APP_URL);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Ignorer si presse-papier indisponible
    }
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
    PUBLIC_APP_URL
  )}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Barre supérieure principale */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-900 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src="/logo-lifras.jpg"
              alt="Logo Officiel LIFRAS"
              className="h-11 w-11 shrink-0 rounded-full border border-sky-400/50 bg-white object-cover shadow"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white">
                  Carnet de Bord Digital CMN
                </span>
                <Badge className="bg-sky-500/20 text-sky-300 border-sky-400/30">
                  LIFRAS
                </Badge>
                <Badge
                  variant="outline"
                  className="border-emerald-400/50 bg-emerald-500/20 font-mono text-[11px] text-emerald-200"
                >
                  {APP_VERSION}
                </Badge>
              </div>
              <p className="text-xs text-slate-300">
                Cursus Candidats Moniteurs Nationaux • Mode ISO-EXCEL
              </p>
            </div>
          </div>

          {/* État réseau PWA + Badge Outbox IndexedDB + Utilisateur connecté */}
          <div className="flex flex-wrap items-center gap-2.5">
            {outboxCount > 0 && (
              <button
                type="button"
                onClick={() => void handleManualFlush()}
                disabled={isFlushing}
                title="Cliquez pour synchroniser immédiatement la boîte d'envoi IndexedDB vers Supabase"
                className="flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-500/25 px-3 py-1 text-xs font-bold text-amber-200 transition hover:bg-amber-500/40"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isFlushing ? 'animate-spin' : ''}`}
                />
                <span>En attente de réseau ({outboxCount})</span>
              </button>
            )}

            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                isOnline
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
              title="État de synchronisation PWA / IndexedDB (Dexie)"
            >
              {isOnline ? (
                <>
                  <Wifi className="h-3.5 w-3.5" />
                  <span>En ligne</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  <span>Hors-ligne</span>
                </>
              )}
            </div>

            {isDemoMode && (
              <select
                aria-label="Changer de rôle (Mode Démo)"
                value={profile.role}
                onChange={(e) => switchDemoRole(e.target.value as UserRole)}
                className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    Vue : {USER_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-2">
              {profile.photo_storage_path ? (
                <img
                  src={profile.photo_storage_path}
                  alt={`${profile.first_name} ${profile.last_name}`}
                  className="h-8 w-8 rounded-full border border-sky-400 object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-700 text-xs font-bold text-white">
                  {`${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase()}
                </div>
              )}
              <div className="hidden sm:block text-right">
                <div className="text-xs font-semibold text-white">
                  {profile.first_name} {profile.last_name}
                </div>
                <div className="text-[11px] text-sky-300">
                  {USER_ROLE_LABELS[profile.role]} • FEBRAS #
                  {profile.febras_number ?? 'N/A'}
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Déconnexion</span>
            </Button>
          </div>
        </div>

        {/* Navigation filtrée par rôle + Bouton QR Code à droite de Administration & Audit (visible par tous les profils) */}
        <nav className="border-t border-slate-800 bg-slate-950/60">
          <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-1.5 sm:px-6">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}

            {/* Bouton QR Code placé immédiatement à droite des onglets de navigation et accessible à tous les profils */}
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-2 rounded-md border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-300 transition hover:bg-sky-600 hover:text-white"
            >
              <QrCode className="h-4 w-4" />
              <span>QR Code Application</span>
            </button>
          </div>
        </nav>
      </header>

      {/* Modale QR Code de partage de l'application */}
      {showQrModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
        >
          <Card className="w-full max-w-md border-sky-200 bg-white shadow-2xl">
            <CardHeader className="border-b bg-slate-50 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sky-700">
                  <QrCode className="h-5 w-5" />
                  <CardTitle className="text-base">
                    Partager le Carnet de Bord Digital CMN
                  </CardTitle>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowQrModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Scannez ce QR Code avec l’appareil photo d’un smartphone pour
                ouvrir et installer l’application ({APP_VERSION}).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4 pt-6">
              <div className="rounded-2xl border-2 border-sky-100 bg-white p-3 shadow-sm">
                <img
                  src={qrImageUrl}
                  alt="QR Code Carnet de Bord CMN LIFRAS"
                  className="h-56 w-56"
                />
              </div>

              <div className="w-full rounded-lg border bg-slate-50 p-2.5 text-center font-mono text-xs font-semibold text-sky-800 break-all">
                {PUBLIC_APP_URL}
              </div>

              <div className="flex w-full gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => void handleCopyUrl()}
                >
                  {copiedUrl ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>Lien copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copier le lien</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-sky-600 text-white hover:bg-sky-700"
                  onClick={() => setShowQrModal(false)}
                >
                  Fermer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contenu principal */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>

      {/* Pied de page réglementaire */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Commission de l’Enseignement LIFRAS — Carnet de Bord Digital CMN ({APP_VERSION}) •
        Moteur certifié Iso-Excel (`src/domain/scoringEngine.ts`) • RLS 100 % activé
      </footer>
    </div>
  );
}
