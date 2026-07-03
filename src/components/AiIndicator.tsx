import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';

type Status = 'checking' | 'configured' | 'unconfigured' | 'error';

interface HealthAi {
  configured: boolean;
  provider: string | null;
  model: string | null;
}

export default function AiIndicator() {
  const [status, setStatus] = useState<Status>('checking');
  const [ai, setAi] = useState<HealthAi | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAi();
    const interval = setInterval(checkAi, 60_000); // re-check every 60s
    return () => clearInterval(interval);
  }, []);

  async function checkAi() {
    try {
      if (!window.__TAURI_INTERNALS__) {
        setStatus('unconfigured');
        return;
      }
      const health = await invoke<{
        ai: { configured: boolean; provider: string | null; model: string | null };
      }>('check_health');
      setAi(health.ai);
      setStatus(health.ai.configured ? 'configured' : 'unconfigured');
    } catch {
      setStatus('error');
    }
  }

  const dotColor =
    status === 'configured' ? 'var(--color-status-green)' :
    status === 'unconfigured' ? 'var(--color-status-red)' :
    'var(--color-status-amber)'; // checking / error

  const label =
    status === 'configured' ? (ai?.model || ai?.provider || 'AI aktif') :
    status === 'unconfigured' ? 'AI belum diatur' :
    status === 'checking' ? 'Memeriksa...' :
    'Gagal memeriksa';

  return (
    <button
      onClick={() => navigate('/settings')}
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: 6,
        fontSize: 11,
        color: 'var(--color-text-muted)',
        width: '100%',
        textAlign: 'left',
        lineHeight: 1.3,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(120,113,108,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }}
      />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  );
}
