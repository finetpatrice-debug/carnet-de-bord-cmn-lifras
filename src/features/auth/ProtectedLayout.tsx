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
import {
  getStoredNotifications,
  markAllNotificationsRead,
  pushAppNotification,
  requestBrowserNotificationPermission,
  type AppNotificationItem,
} from '@/services/notificationService';
import {
  recordConnectionEvent,
  subscribePresence,
} from '@/services/presenceService';
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
  Maximize2,
  Minimize2,
  Bell,
  Sun,
  Moon,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  shortMobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/tableau-de-bord',
    label: 'Tableau de Bord',
    shortMobileLabel: 'Tableau',
    icon: LayoutDashboard,
    allowedRoles: ['ADMIN_DTF', 'MN_EVALUATOR', 'CMN_CANDIDATE'],
  },
  {
    to: '/evaluations',
    label: 'Évaluation Terrain',
    shortMobileLabel: 'Évaluer',
    icon: ClipboardCheck,
    allowedRoles: ['ADMIN_DTF', 'MN_EVALUATOR'],
  },
  {
    to: '/import-excel',
    label: 'Import Iso-Excel',
    shortMobileLabel: 'Import',
    icon: FileSpreadsheet,
    allowedRoles: ['ADMIN_DTF'],
  },
  {
    to: '/administration',
    label: 'Administration & Audit',
    shortMobileLabel: 'Admin',
    icon: Shield,
    allowedRoles: ['ADMIN_DTF'],
  },
];

const ALL_ROLES: UserRole[] = [
  'ADMIN_DTF',
  'MN_EVALUATOR',
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
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showNotifPanel, setShowNotifPanel] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<AppNotificationItem[]>(() =>
    getStoredNotifications()
  );

  // Confort visuel : Taille des caractères (85% à 130%) & Mode Jour / Nuit
  const [fontScale, setFontScale] = useState<number>(() => {
    const saved = localStorage.getItem('cmn_lifras_font_scale');
    const parsed = saved ? Number.parseInt(saved, 10) : 100;
    return Number.isNaN(parsed) ? 100 : Math.min(130, Math.max(85, parsed));
  });

  const [isNightMode, setIsNightMode] = useState<boolean>(() => {
    return localStorage.getItem('cmn_lifras_theme_mode') === 'dark';
  });

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontScale}%`;
    localStorage.setItem('cmn_lifras_font_scale', String(fontScale));
  }, [fontScale]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isNightMode);
    localStorage.setItem('cmn_lifras_theme_mode', isNightMode ? 'dark' : 'light');
  }, [isNightMode]);

  const adjustFontSize = (delta: number): void => {
    setFontScale((prev) => Math.min(130, Math.max(85, prev + delta)));
  };

  const outboxCount =
    useLiveQuery(
      () => offlineDb.outbox_evaluations.count(),
      [],
      0
    ) ?? 0;

  useEffect(() => {
    void syncLocalReferentialsCache(candidates, mnDirectory);
  }, [candidates, mnDirectory]);

  // Suivi discret de présence temps réel & journal de connexion (module isolé silencieux)
  useEffect(() => {
    if (!profile) return;
    void recordConnectionEvent(profile);
    return subscribePresence(profile);
  }, [profile?.id, profile?.email, profile?.role]);

  // Synchronisation automatique en arrière-plan (Background Sync : online + visibilitychange + intervalle 30s)
  useEffect(() => {
    const triggerBackgroundSync = (): void => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      setIsFlushing(true);
      void flushOutboxEvaluations(recordFieldEvaluation).finally(() => {
        setIsFlushing(false);
      });
    };

    const handleOnline = (): void => {
      setIsOnline(true);
      triggerBackgroundSync();
    };
    const handleOffline = (): void => setIsOnline(false);
    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        triggerBackgroundSync();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    const intervalId = window.setInterval(triggerBackgroundSync, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(intervalId);
    };
  }, [recordFieldEvaluation]);

  // Écoute des notifications Push / locales et de l'état plein écran
  useEffect(() => {
    const refreshNotifs = (): void => setNotifications(getStoredNotifications());
    const handleFsChange = (): void =>
      setIsFullscreen(Boolean(document.fullscreenElement));

    window.addEventListener('cmn-notification-added', refreshNotifs);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      window.removeEventListener('cmn-notification-added', refreshNotifs);
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  const toggleFullscreen = async (): Promise<void> => {
    try {
      if (!document.fullscreenElement) {
        sessionStorage.removeItem('cmn_fs_dismissed');
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      } else if (document.exitFullscreen) {
        sessionStorage.setItem('cmn_fs_dismissed', '1');
        await document.exitFullscreen();
      }
    } catch {
      // Ignorer si non supporté par le navigateur iOS Safari
    }
  };

  const handleEnablePushNotifications = async (): Promise<void> => {
    const perm = await requestBrowserNotificationPermission();
    if (perm === 'granted') {
      pushAppNotification(
        'Notifications LIFRAS activées',
        'Vous serez alerté instantanément à chaque nouvelle évaluation ou synchronisation.'
      );
    }
  };

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

  const unreadCount = notifications.filter((n) => !n.read).length;

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
      // Ignorer
    }
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
    PUBLIC_APP_URL
  )}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-16 md:pb-0">
      {/* Barre supérieure principale : compacte et sans chevauchement sur Mobile (< md), complète sur PC (md+) */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:px-6 md:py-3">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <img
              src="/logo-lifras.jpg"
              alt="Logo Officiel LIFRAS"
              className="h-8 w-8 sm:h-9 sm:w-9 md:h-11 md:w-11 shrink-0 rounded-full border border-sky-400/50 bg-white object-cover shadow"
            />
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="hidden sm:inline text-sm md:text-base font-bold tracking-tight text-white">
                  Carnet de Bord Digital CMN
                </span>
                <Badge className="hidden sm:inline-flex bg-sky-500/20 text-sky-300 border-sky-400/30">
                  LIFRAS
                </Badge>
                <Badge
                  variant="outline"
                  className="shrink-0 whitespace-nowrap border-emerald-400/50 bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] md:text-[11px] text-emerald-200"
                >
                  {APP_VERSION}
                </Badge>
              </div>
              <p className="hidden md:block text-xs text-slate-300">
                Cursus Candidats Moniteurs Nationaux • Mode ISO-EXCEL
              </p>
            </div>
          </div>

          {/* Contrôles de droite */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {outboxCount > 0 && (
              <button
                type="button"
                onClick={() => void handleManualFlush()}
                disabled={isFlushing}
                title="Synchronisation automatique en arrière-plan active — Cliquez pour forcer maintenant"
                className="flex shrink-0 items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/25 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-amber-200 transition hover:bg-amber-500/40"
              >
                <RefreshCw
                  className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${isFlushing ? 'animate-spin' : ''}`}
                />
                <span className="hidden md:inline">En attente de réseau</span>
                <span>({outboxCount})</span>
              </button>
            )}

            <div
              className={`hidden sm:flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                isOnline
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
              title="Synchronisation arrière-plan PWA / IndexedDB (Dexie)"
            >
              {isOnline ? (
                <>
                  <Wifi className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">En ligne</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Hors-ligne</span>
                </>
              )}
            </div>

            {/* Barre discrète de confort visuel : Taille du texte (A- / A+) & Mode Jour / Nuit */}
            <div
              role="group"
              aria-label="Confort visuel : taille du texte et thème jour/nuit"
              className="flex items-center rounded-lg border border-slate-700 bg-slate-800/90 p-0.5 text-slate-200"
            >
              <button
                type="button"
                onClick={() => adjustFontSize(-8)}
                disabled={fontScale <= 85}
                title="Diminuer la taille des caractères (A-)"
                className="flex h-7 px-1.5 items-center justify-center rounded text-[11px] font-bold hover:bg-slate-700 disabled:opacity-40"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setFontScale(100)}
                title={`Taille actuelle : ${fontScale}% (Toucher pour réinitialiser à 100%)`}
                className="hidden sm:flex h-7 px-1 items-center justify-center font-mono text-[10px] text-sky-300 hover:bg-slate-700"
              >
                {fontScale}%
              </button>
              <button
                type="button"
                onClick={() => adjustFontSize(8)}
                disabled={fontScale >= 130}
                title="Agrandir la taille des caractères (A+)"
                className="flex h-7 px-1.5 items-center justify-center rounded text-xs font-extrabold hover:bg-slate-700 disabled:opacity-40"
              >
                A+
              </button>
              <div className="mx-0.5 h-4 w-[1px] bg-slate-700" />
              <button
                type="button"
                onClick={() => setIsNightMode((prev) => !prev)}
                title={
                  isNightMode
                    ? 'Passer en Mode Jour (Clair)'
                    : 'Passer en Mode Nuit (Sombre)'
                }
                aria-label="Basculer entre le mode jour et le mode nuit"
                className="flex h-7 w-7 items-center justify-center rounded text-amber-300 hover:bg-slate-700"
              >
                {isNightMode ? (
                  <Sun className="h-3.5 w-3.5 text-amber-300" />
                ) : (
                  <Moon className="h-3.5 w-3.5 text-sky-300" />
                )}
              </button>
            </div>

            {/* Bouton Plein Écran (dédié au confort sur smartphone / tablette) */}
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              title={
                isFullscreen ? 'Quitter le plein écran' : 'Passer en plein écran'
              }
              className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-sky-300 hover:bg-slate-700"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>

            {/* Cloche de Notifications Push / Alertes évaluations */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifPanel((prev) => !prev);
                  if (!showNotifPanel && unreadCount > 0) {
                    setNotifications(markAllNotificationsRead());
                  }
                }}
                title="Notifications & Alertes d'évaluations"
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifPanel && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl z-50">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold text-slate-900">
                      Notifications & Sync Arrière-Plan
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleEnablePushNotifications()}
                      className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800 hover:bg-sky-200"
                    >
                      Activer Push Mobile
                    </button>
                  </div>
                  <div className="mt-2 max-h-60 space-y-2 overflow-y-auto text-xs">
                    {notifications.length === 0 ? (
                      <p className="py-4 text-center text-slate-400">
                        Aucune notification récente.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className="rounded-lg border border-slate-100 bg-slate-50 p-2"
                        >
                          <div className="font-semibold text-slate-900">
                            {n.title}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            {n.body}
                          </div>
                          <div className="mt-1 text-[10px] text-slate-400">
                            {new Date(n.createdAt).toLocaleString('fr-BE')}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {isDemoMode && (
              <select
                aria-label="Changer de rôle (Mode Démo)"
                value={profile.role}
                onChange={(e) => switchDemoRole(e.target.value as UserRole)}
                className="max-w-[88px] sm:max-w-none rounded-md border border-slate-700 bg-slate-800 px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {USER_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            )}

            <div className="hidden sm:flex items-center gap-2">
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
              <div className="hidden lg:block text-right">
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
              className="px-2 sm:px-3 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Déconnexion</span>
            </Button>
          </div>
        </div>

        {/* Navigation PC (inchangée sur écran PC md+, masquée sur smartphone où elle devient une barre basse native) */}
        <nav className="hidden md:block border-t border-slate-800 bg-slate-950/60">
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
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 md:py-6">
        <Outlet />
      </main>

      {/* Barre de navigation basse dédiée au Mobile (< md) utilisable au pouce en plein écran */}
      <nav
        aria-label="Navigation mobile"
        className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden items-center justify-around border-t border-slate-800 bg-slate-900/95 px-1 py-1.5 text-white shadow-2xl backdrop-blur"
      >
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[10px] font-semibold transition ${
                  isActive
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{item.shortMobileLabel}</span>
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={() => setShowQrModal(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[10px] font-semibold text-sky-300 hover:text-white"
        >
          <QrCode className="h-4 w-4" />
          <span>QR Code</span>
        </button>
      </nav>

      {/* Pied de page réglementaire (PC) */}
      <footer className="hidden md:block border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Commission de l’Enseignement LIFRAS — Carnet de Bord Digital CMN ({APP_VERSION}) •
        Moteur certifié Iso-Excel (`src/domain/scoringEngine.ts`) • RLS 100 % activé
      </footer>
    </div>
  );
}
