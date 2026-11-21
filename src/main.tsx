import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Mise à jour automatique instantanée du Service Worker (empêche le cache de bloquer les nouvelles versions)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let reloadingForSwUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForSwUpdate) return;
    reloadingForSwUpdate = true;
    window.location.reload();
  });

  const checkForSwUpdate = (): void => {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        regs.forEach((reg) => {
          void reg.update();
        });
      })
      .catch(() => {
        // Ignorer si hors-ligne
      });
  };

  window.addEventListener('focus', checkForSwUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForSwUpdate();
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Élément racine #root introuvable dans index.html.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
