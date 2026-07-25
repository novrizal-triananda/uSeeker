import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { confirmAsync } from '../lib/confirm';
import { useTheme } from '../lib/theme';
import { exportAllData, importAllData } from '../lib/backup';
import { flush } from '../lib/db';

interface AiSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface SearchSettings {
  tavilyKey: string;
}

const THEMES = [
  { key: 'light' as const, label: 'Terang', icon: '☀️' },
  { key: 'dark' as const, label: 'Gelap', icon: '🌙' },
  { key: 'pink' as const, label: 'Pink', icon: '🌸' },
];

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AiSettings>({ apiKey: '', baseUrl: '', model: '' });
  const [searchSettings, setSearchSettings] = useState<SearchSettings>({ tavilyKey: '' });
  const [saved, setSaved] = useState(false);
  const [searchSaved, setSearchSaved] = useState(false);
  const [error, setError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      if (window.__TAURI_INTERNALS__) {
        const config = await invoke<AiSettings>('get_ai_config');
        setSettings({ apiKey: config.apiKey || '', baseUrl: config.baseUrl || '', model: config.model || '' });
        const searchConfig = await invoke<SearchSettings>('get_search_config');
        setSearchSettings({ tavilyKey: searchConfig.tavilyKey || '' });
      }
    } catch (e) { console.error('Failed to load settings:', e); } finally { setLoading(false); }
  }

  async function handleSave() {
    if (!settings.apiKey.trim()) { setError('API key wajib diisi'); return; }
    if (!settings.baseUrl.trim()) { setError('Base URL wajib diisi'); return; }
    if (!settings.model.trim()) { setError('Nama model wajib diisi'); return; }
    setError(''); setSaved(false);
    try {
      if (window.__TAURI_INTERNALS__) {
        await invoke('save_config', { key: 'api_key', value: settings.apiKey.trim() });
        await invoke('save_config', { key: 'base_url', value: settings.baseUrl.trim().replace(/\/+$/, '') });
        await invoke('save_config', { key: 'model', value: settings.model.trim() });
      }
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError('Gagal menyimpan: ' + String(e)); }
  }

  async function handleSearchSave() {
    setSearchError(''); setSearchSaved(false);
    try {
      if (window.__TAURI_INTERNALS__) {
        await invoke('save_config', { key: 'tavily_key', value: searchSettings.tavilyKey.trim() });
      }
      setSearchSaved(true); setTimeout(() => setSearchSaved(false), 3000);
    } catch (e) { setSearchError('Gagal menyimpan: ' + String(e)); }
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading settings...</div>;
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Settings</h1>
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
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>AI Settings</h2>
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
          <label style={labelStyle}>Model</label>
          <input type="text" style={inputStyle} value={settings.model}
            onChange={(e) => { setSettings(s => ({ ...s, model: e.target.value })); setError(''); setSaved(false); }}
            placeholder="deepseek-chat" />
          <p style={hintStyle}>Nama model yang digunakan oleh penyedia AI. Contoh: deepseek-chat, gpt-4o, gemini-2.0-flash</p>
        </div>
        {error && <p style={{ color: 'var(--color-status-red)', fontSize: '0.875rem', marginBottom: '16px' }}>{error}</p>}
        {saved && <p style={{ color: 'var(--color-status-green)', fontSize: '0.875rem', marginBottom: '16px' }}>Settings saved.</p>}
        <button onClick={handleSave} style={saveBtnStyle}>Save Settings</button>
      </div>

      {/* Search Settings */}
      <div style={{ ...cardStyle, marginTop: '16px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Search Settings</h2>
        <div style={fieldStyle}>
          <label style={labelStyle}>Tavily API Key</label>
          <input type="password" style={inputStyle} value={searchSettings.tavilyKey}
            onChange={(e) => { setSearchSettings(s => ({ ...s, tavilyKey: e.target.value })); setSearchError(''); setSearchSaved(false); }}
            placeholder="tvly-..." />
          <p style={hintStyle}>
            Kunci API untuk pencarian web. Dapatkan gratis di{' '}
            <a href="https://app.tavily.com" target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
              tavily.com
            </a>{' '}
            (1,000 pencarian/bulan). Tanpa kunci, uSeeker menggunakan DuckDuckGo (terbatas).
          </p>
        </div>
        {searchError && <p style={{ color: 'var(--color-status-red)', fontSize: '0.875rem', marginBottom: '16px' }}>{searchError}</p>}
        {searchSaved && <p style={{ color: 'var(--color-status-green)', fontSize: '0.875rem', marginBottom: '16px' }}>Search settings saved.</p>}
        <button onClick={handleSearchSave} style={saveBtnStyle}>Save Search Settings</button>
      </div>

      {/* Privacy Note */}
      <div style={{ marginTop: '16px', padding: '16px', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          Kunci API kamu disimpan secara lokal. Tidak ada data yang dikirim ke server uSeeker.
        </p>
      </div>

      {/* Data Backup */}
      <div style={{ ...cardStyle, marginTop: '16px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Backup Data</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
          Backup semua data aplikasi ke file JSON. Gunakan sebelum update atau untuk pindah perangkat.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={async () => {
            try {
              const data = await exportAllData();
              const path = await save({
                defaultPath: `useeker-backup-${new Date().toISOString().slice(0, 10)}.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }],
              });
              if (path) {
                await invoke("export_to_file", { path, data: JSON.stringify(data) });
                alert('Backup berhasil disimpan.');
              }
            } catch (e) { alert('Gagal backup: ' + String(e)); }
          }} style={{ ...saveBtnStyle, flex: 1, background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>Export Data</button>
          <button onClick={async () => {
            try {
              const path = await open({
                filters: [{ name: 'JSON', extensions: ['json'] }],
                multiple: false,
              });
              if (!path) return;
              const text = await invoke<string>("import_from_file", { path: path as string });
              const data = JSON.parse(text);
              if (!(await confirmAsync('Import akan mengganti semua data yang ada. Lanjutkan?'))) return;
              await importAllData(data);
              await flush();
              alert('Import berhasil. Muat ulang halaman.');
              window.location.reload();
            } catch (e) { alert('Gagal import: ' + String(e)); }
          }} style={{ ...saveBtnStyle, flex: 1, background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>Import Data</button>
        </div>
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
