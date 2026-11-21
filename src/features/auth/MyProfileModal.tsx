import React, { useState } from 'react';
import type { Profile } from '@/domain/types';
import { USER_ROLE_LABELS } from '@/domain/types';
import { setAuthorizedPassword } from '@/services/authorizedAccessService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Camera, CheckCircle2, KeyRound, Lock, X } from 'lucide-react';

interface MyProfileModalProps {
  profile: Profile;
  onClose: () => void;
  onSave: (updated: Profile) => void;
}

function compressPhotoFile(
  file: File,
  onLoaded: (dataUrl: string) => void
): void {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result !== 'string') return;
    const rawDataUrl = reader.result;
    const img = new Image();
    img.onload = () => {
      try {
        const MAX_DIM = 256;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onLoaded(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        onLoaded(canvas.toDataURL('image/jpeg', 0.8));
      } catch {
        onLoaded(rawDataUrl);
      }
    };
    img.onerror = () => onLoaded(rawDataUrl);
    img.src = rawDataUrl;
  };
  reader.readAsDataURL(file);
}

export function MyProfileModal({
  profile,
  onClose,
  onSave,
}: MyProfileModalProps): React.ReactElement {
  const [draft, setDraft] = useState<Profile>({ ...profile });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdFeedback, setPwdFeedback] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    // Verrouillage strict : impossible de modifier son rôle/statut ou son e-mail d'accès
    const safeUpdated: Profile = {
      ...draft,
      id: profile.id,
      role: profile.role,
      email: profile.email,
      cohort_id: profile.cohort_id,
      updated_at: new Date().toISOString(),
    };
    onSave(safeUpdated);
    setSavedFeedback('Vos données personnelles ont bien été enregistrées.');
    setTimeout(() => {
      onClose();
    }, 650);
  };

  const handlePasswordChange = async (): Promise<void> => {
    setPwdFeedback(null);
    if (newPassword.trim().length < 6) {
      setPwdFeedback({
        type: 'err',
        msg: 'Le mot de passe doit comporter au moins 6 caractères.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdFeedback({
        type: 'err',
        msg: 'Les deux mots de passe ne correspondent pas.',
      });
      return;
    }
    await setAuthorizedPassword(profile.email, profile.id, newPassword.trim());
    setNewPassword('');
    setConfirmPassword('');
    setPwdFeedback({
      type: 'ok',
      msg: 'Mot de passe mis à jour avec succès.',
    });
  };

  const initials = `${draft.first_name.charAt(0)}${draft.last_name.charAt(0)}`.toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mes données personnelles"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-slate-900/75 p-0 sm:p-6 backdrop-blur-sm"
    >
      <form
        onSubmit={handleSubmit}
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-sky-300"
      >
        {/* En-tête */}
        <div className="flex shrink-0 items-center justify-between border-b bg-slate-900 px-4 py-3.5 text-white sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {draft.photo_storage_path ? (
              <img
                src={draft.photo_storage_path}
                alt={`${draft.first_name} ${draft.last_name}`}
                className="h-10 w-10 shrink-0 rounded-full border-2 border-sky-400 object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-700 text-xs font-bold text-white">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm sm:text-base font-bold text-white">
                Mes données personnelles
              </div>
              <div className="truncate text-[11px] text-sky-300">
                {draft.first_name} {draft.last_name}
              </div>
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Fermer"
            onClick={onClose}
            className="shrink-0 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {savedFeedback && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{savedFeedback}</span>
            </div>
          )}

          {/* Bandeau statut & e-mail strictement verrouillés */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="font-semibold text-slate-700">
                Statut officiel (verrouillé) :
              </span>
              <Badge className="bg-slate-900 text-white">
                {USER_ROLE_LABELS[profile.role]}
              </Badge>
            </div>
            <span className="font-mono text-[11px] text-slate-500">
              {profile.email}
            </span>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Prénom
              </label>
              <Input
                value={draft.first_name}
                onChange={(e) =>
                  setDraft({ ...draft, first_name: e.target.value })
                }
                required
                className="mt-1 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Nom
              </label>
              <Input
                value={draft.last_name}
                onChange={(e) =>
                  setDraft({ ...draft, last_name: e.target.value })
                }
                required
                className="mt-1 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">
                N° FEBRAS
              </label>
              <Input
                value={draft.febras_number ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, febras_number: e.target.value || null })
                }
                className="mt-1 bg-white font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Téléphone GSM
              </label>
              <Input
                placeholder="Ex: 0475123456"
                value={draft.phone_gsm ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, phone_gsm: e.target.value || null })
                }
                className="mt-1 bg-white font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Téléphone fixe
              </label>
              <Input
                placeholder="Ex: 010223344"
                value={draft.phone_landline ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, phone_landline: e.target.value || null })
                }
                className="mt-1 bg-white font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Date de naissance
              </label>
              <Input
                type="date"
                value={draft.birth_date ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, birth_date: e.target.value || null })
                }
                className="mt-1 bg-white"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-semibold text-slate-700">
                Rue et numéro
              </label>
              <Input
                value={draft.street_address ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, street_address: e.target.value || null })
                }
                className="mt-1 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Code postal
              </label>
              <Input
                value={draft.postal_code ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, postal_code: e.target.value || null })
                }
                className="mt-1 bg-white font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Localité / Ville
              </label>
              <Input
                value={draft.city ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, city: e.target.value || null })
                }
                className="mt-1 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Club affilié LIFRAS
              </label>
              <Input
                value={draft.club_name ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, club_name: e.target.value || null })
                }
                className="mt-1 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Nombre de plongées
              </label>
              <Input
                type="number"
                value={draft.dives_count ?? 0}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    dives_count: Number.parseInt(e.target.value, 10) || 0,
                  })
                }
                className="mt-1 bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Année CFPS
                </label>
                <Input
                  type="number"
                  value={draft.cfps_year ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      cfps_year: Number.parseInt(e.target.value, 10) || null,
                    })
                  }
                  className="mt-1 bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Année MF
                </label>
                <Input
                  type="number"
                  value={draft.mf_year ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      mf_year: Number.parseInt(e.target.value, 10) || null,
                    })
                  }
                  className="mt-1 bg-white"
                />
              </div>
            </div>

            {/* Photo de profil */}
            <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <label className="text-xs font-semibold text-slate-700">
                Ma photo de profil
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {draft.photo_storage_path ? (
                  <img
                    src={draft.photo_storage_path}
                    alt={`${draft.first_name} ${draft.last_name}`}
                    className="h-14 w-14 rounded-full border-2 border-sky-500 object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                    <Camera className="h-5 w-5" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  aria-label="Choisir ma photo de profil"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      compressPhotoFile(file, (dataUrl) =>
                        setDraft((prev) => ({
                          ...prev,
                          photo_storage_path: dataUrl,
                        }))
                      );
                    }
                  }}
                  className="text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-sky-700"
                />
              </div>
            </div>

            {/* Changement de mot de passe personnel */}
            <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
                <KeyRound className="h-4 w-4 text-sky-700" />
                <span>Modifier mon mot de passe (optionnel)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="password"
                  placeholder="Nouveau mot de passe (min. 6 car.)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-8 max-w-[220px] bg-white text-xs"
                />
                <Input
                  type="password"
                  placeholder="Confirmer"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-8 max-w-[180px] bg-white text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handlePasswordChange()}
                  className="h-8 border-sky-300 bg-white text-xs text-sky-900 hover:bg-sky-100"
                >
                  Mettre à jour le mot de passe
                </Button>
              </div>
              {pwdFeedback && (
                <div
                  className={`text-xs font-semibold ${
                    pwdFeedback.type === 'ok'
                      ? 'text-emerald-700'
                      : 'text-red-600'
                  }`}
                >
                  {pwdFeedback.msg}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pied fixe */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-slate-50 px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            Enregistrer mes données
          </Button>
        </div>
      </form>
    </div>
  );
}
