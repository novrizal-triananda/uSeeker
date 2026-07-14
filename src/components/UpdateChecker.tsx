import { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { invoke } from '@tauri-apps/api/core';
import { exportAllData } from '../lib/backup';

type UpdateState = 'idle' | 'checking' | 'available' | 'installing' | 'up-to-date' | 'error' | 'relaunching';

export default function UpdateChecker() {
  const [state, setState] = useState<UpdateState>('idle');
  const [version, setVersion] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [downloaded, setDownloaded] = useState(0);
  const [contentLength, setContentLength] = useState(0);

  useEffect(() => {
    import('@tauri-apps/api/app').then(({ getVersion }) => {
      getVersion().then(setVersion).catch(() => {});
    });
  }, []);

  const checkForUpdate = async () => {
    setState('checking');
    setErrorMsg('');
    try {
      const update = await check();
      if (update) {
        setVersion(update.version);
        setState('available');
      } else {
        setState('up-to-date');
      }
    } catch (err) {
      setErrorMsg(String(err));
      setState('error');
    }
  };

  const downloadAndInstall = async () => {
    setState('installing');
    try {
      const update = await check();
      if (!update) {
        setState('up-to-date');
        return;
      }
      // Auto-backup before update
      try {
        const data = await exportAllData();
        await invoke('backup_database', { data: JSON.stringify(data) });
      } catch {
        // Backup failed — proceed anyway, don't block update
      }

      let contentLen = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLen = event.data.contentLength || 0;
            setContentLength(contentLen);
            break;
          case 'Progress':
            setDownloaded((prev) => prev + (event.data.chunkLength || 0));
            break;
          case 'Finished':
            break;
        }
      });

      setState('relaunching');
      await relaunch();
    } catch (err) {
      setErrorMsg(String(err));
      setState('error');
    }
  };

  const progressPercent = contentLength > 0
    ? Math.min(100, Math.round((downloaded / contentLength) * 100))
    : 0;

  return (
    <div style={{
      padding: '0.75rem 1rem',
      borderTop: '1px solid var(--color-border, #e5e7eb)',
      fontSize: '0.75rem',
    }}>
      <button
        onClick={state === 'available' || state === 'idle' ? (state === 'available' ? downloadAndInstall : checkForUpdate) : undefined}
        disabled={state === 'checking' || state === 'installing' || state === 'relaunching'}
        style={{
          width: '100%',
          padding: '0.4rem 0.75rem',
          border: '1px solid var(--color-border, #e5e7eb)',
          borderRadius: '0.375rem',
          background: state === 'available' ? 'var(--color-primary, #2563eb)' : 'var(--color-surface, #fff)',
          color: state === 'available' ? '#fff' : 'var(--color-text-secondary, #6b7280)',
          cursor: (state === 'checking' || state === 'installing' || state === 'relaunching') ? 'wait' : 'pointer',
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.375rem',
        }}
        aria-label="Cek update"
      >
        {state === 'checking' && '⏳ Mengecek...'}
        {state === 'idle' && '🔄 Cek Update'}
        {state === 'available' && '⬇️ Update Sekarang'}
        {state === 'installing' && `⬇️ Mengunduh... ${progressPercent}%`}
        {state === 'relaunching' && '🔄 Memulai ulang...'}
        {state === 'up-to-date' && '✓ Versi terbaru'}
        {state === 'error' && '⚠️ Gagal'}
      </button>

      {state === 'installing' && contentLength > 0 && (
        <div style={{ marginTop: '0.375rem' }}>
          <div style={{
            width: '100%',
            height: '4px',
            background: 'var(--color-border, #e5e7eb)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'var(--color-primary, #2563eb)',
              transition: 'width 0.3s',
            }} />
          </div>
          <div style={{
            marginTop: '0.25rem',
            textAlign: 'center',
            color: 'var(--color-text-muted, #9ca3af)',
            fontSize: '0.65rem',
          }}>
            {formatBytes(downloaded)} / {formatBytes(contentLength)}
          </div>
        </div>
      )}

      {state === 'up-to-date' && (
        <div style={{ marginTop: '0.5rem', color: 'var(--color-success, #16a34a)', textAlign: 'center' }}>
          ✓ Versi terbaru
        </div>
      )}

      {state === 'error' && (
        <div style={{ marginTop: '0.5rem', color: 'var(--color-error, #dc2626)', textAlign: 'center', fontSize: '0.7rem' }}>
          {errorMsg || 'Gagal mengecek update'}
        </div>
      )}

      <div style={{ marginTop: '0.375rem', textAlign: 'center', color: 'var(--color-text-muted, #9ca3af)', fontSize: '0.65rem' }}>
        v{version}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
