import { useState, useEffect } from 'react';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: 'var(--color-status-amber)',
        color: 'var(--color-text)',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: 'var(--font-size-sm)',
      }}
    >
      Anda sedang offline. Fitur AI tidak tersedia.
    </div>
  );
}
