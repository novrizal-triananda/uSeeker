import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTheme } from '../lib/theme';

interface AiSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const THEMES = [
  { key: 'light' as const, label: 'Terang', icon: '☀️' },
  { key: 'dark' as const, label: 'Gelap', icon: '🌙' },
  { key: 'pink' as const, label: 'Pink', icon: '🌸' },
];

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AiSettings>({ apiKey: '', baseUrl: '', model: '' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      if (window.__TAURI_INTERNALS__) {
        const config = await invoke<AiSettings>('get_ai_config');
        setSettings({ apiKey: '', baseUrl: config.baseUrl || '', model: config.model || '' });
      }
    } catch (e) { console.error('Failed to load settings:', e); } finally { setLoading(false); }
  }

  async function handleSave() {
    if (!settings.apiKey.trim()) { setError('API key wajib diisi'); return; }
    if (!settings.baseUrl.trim()) { setError('Base URL wajib diisi'); return; }
    setError(''); setSaved(false);
    try {
      if (window.__TAURI_INTERNALS__) {
        await invoke('save_config', { key: 'api_key', value: settings.apiKey.trim() });
        await invoke('save_config', { key: 'base_url', value: settings.baseUrl.trim().replace(/\/+$/, '') });
        if (settings.model.trim()) { await invoke('save_config', { key: 'model', value: settings.model.trim() }); }
        else { await invoke('save_config', { key: 'model', value: '' }); }
      }
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError('Gagal menyimpan: ' + String(e)); }
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Memuat pengaturan...</div>;
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Pengaturan</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
        Sesuaikan tampilan dan konfigurasi AI.
      </p>

      {/* Theme Switcher */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Tema</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          {THEMES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTheme(t.key)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: `2px solid ${theme === t.key ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: theme === t.key ? 'var(--color-primary)' : 'var(--color-surface)',
                color: theme === t.key ? '#FFFFFF' : 'var(--color-text)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{t.icon}</div>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Config */}
      <div style={{ ...cardStyle, marginTop: '16px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Pengaturan AI</h2>
        <div style={fieldStyle}>
          <label style={labelStyle}>Base URL</label>
          <input type="text" style={inputStyle} value={settings.baseUrl}
            onChange={(e) => { setSettings(s => ({ ...s, baseUrl: e.target.value })); setError(''); setSaved(false); }}
            placeholder="https://api.deepseek.com" />
          <p style={hintStyle}>Endpoint API penyedia AI. Contoh: https://api.deepseek.com, https://openrouter.ai/api/v1</p>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>API Key</label>
          <input type="password" style={inputStyle} value={settings.apiKey}
            onChange={(e) => { setSettings(s => ({ ...s, apiKey: e.target.value })); setError(''); setSaved(false); }}
            placeholder="sk-..." />
          <p style={hintStyle}>Kunci API dari penyedia AI kamu. Disimpan lokal di perangkat ini saja.</p>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Model <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(opsional)</span></label>
          <input type="text" style={inputStyle} value={settings.model}
            onChange={(e) => { setSettings(s => ({ ...s, model: e.target.value })); setError(''); setSaved(false); }}
            placeholder="deepseek-chat" />
          <p style={hintStyle}>Nama model yang digunakan. Kosongkan untuk menggunakan default penyedia.</p>
        </div>
        {error && <p style={{ color: 'var(--color-status-red)', fontSize: '0.875rem', marginBottom: '16px' }}>{error}</p>}
        {saved && <p style={{ color: 'var(--color-status-green)', fontSize: '0.875rem', marginBottom: '16px' }}>Pengaturan tersimpan.</p>}
        <button onClick={handleSave} style={saveBtnStyle}>Simpan Pengaturan</button>
      </div>

      {/* Privacy Note */}
      <div style={{ marginTop: '16px', padding: '16px', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          Kunci API kamu disimpan secara lokal. Tidak ada data yang dikirim ke server uSeeker.
        </p>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: 'var(--color-surface)', borderRadius: '12px', padding: '24px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' };
const fieldStyle: React.CSSProperties = { marginBottom: '20px' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '1rem', fontFamily: 'system-ui, sans-serif', background: 'var(--color-input-bg)', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' as const };
const hintStyle: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', lineHeight: 1.5 };
const saveBtnStyle: React.CSSProperties = { padding: '10px 20px', background: 'var(--color-primary)', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', width: '100%' };
