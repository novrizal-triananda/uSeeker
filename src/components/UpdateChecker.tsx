import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';

interface UpdateInfo {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion: string;
  downloadUrl: string;
  releaseUrl: string;
  releaseNotes: string;
}

// ── CONFIG ──
// Set these to your GitHub repo. For private repos, the GitHub API
// requires auth — but public repos work without a token.
const REPO_OWNER = 'novrizal-triananda';
const REPO_NAME = 'uSeeker';
const CURRENT_VERSION = '2.1.0';

export default function UpdateChecker() {
  const [state, setState] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'error'>('idle');
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const checkForUpdate = async () => {
    setState('checking');
    setErrorMsg('');
    try {
      const result = await invoke<UpdateInfo>('check_update', {
        repoOwner: REPO_OWNER,
        repoName: REPO_NAME,
        currentVersion: CURRENT_VERSION,
      });
      setInfo(result);
      setState(result.updateAvailable ? 'available' : 'up-to-date');
    } catch (err) {
      setErrorMsg(String(err));
      setState('error');
    }
  };

  const openDownload = async () => {
    const url = info?.downloadUrl || info?.releaseUrl;
    if (url) {
      await open(url);
    }
  };

  return (
    <div style={{
      padding: '0.75rem 1rem',
      borderTop: '1px solid var(--color-border, #e5e7eb)',
      fontSize: '0.75rem',
    }}>
      <button
        onClick={checkForUpdate}
        disabled={state === 'checking'}
        style={{
          width: '100%',
          padding: '0.4rem 0.75rem',
          border: '1px solid var(--color-border, #e5e7eb)',
          borderRadius: '0.375rem',
          background: 'var(--color-surface, #fff)',
          color: 'var(--color-text-secondary, #6b7280)',
          cursor: state === 'checking' ? 'wait' : 'pointer',
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.375rem',
        }}
        aria-label="Cek update"
      >
        {state === 'checking' ? '⏳ Mengecek...' : '🔄 Cek Update'}
      </button>

      {state === 'available' && info && (
        <div style={{ marginTop: '0.5rem', color: 'var(--color-primary, #2563eb)' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
            Versi {info.latestVersion} tersedia!
          </div>
          <button
            onClick={openDownload}
            style={{
              width: '100%',
              padding: '0.4rem 0.75rem',
              border: 'none',
              borderRadius: '0.375rem',
              background: 'var(--color-primary, #2563eb)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            Download Update
          </button>
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
        v{CURRENT_VERSION}
      </div>
    </div>
  );
}
