import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AiSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export default function Settings() {
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
        await invoke('save_config', { key: 'base_url', value: settings.baseUrl.trim().replace(/\/\/+$/, '') });
        if (settings.model.trim()) { await invoke('save_config', { key: 'model', value: settings.model.trim() }); }
        else { await invoke('save_config', { key: 'model', value: '' }); }
      }
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError('Gagal menyimpan: ' + String(e)); }
  }

  if (loading) { return <div style={{ padding: '48px', textAlign: 'center', color: '#78716C' }}>Memuat pengaturan...</div>; }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Pengaturan AI</h1>
      <p style={{ fontSize: '0.875rem', color: '#78716C', marginBottom: '24px' }}>
        Konfigurasi penyedia AI untuk fitur riset perusahaan, analisis kecocokan, dan persiapan interview.
      </p>
      <div style={cardStyle}>
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
          <label style={labelStyle}>Model <span style={{ fontWeight: 400, color: '#78716C' }}>(opsional)</span></label>
          <input type="text" style={inputStyle} value={settings.model}
            onChange={(e) => { setSettings(s => ({ ...s, model: e.target.value })); setError(''); setSaved(false); }}
            placeholder="deepseek-chat" />
          <p style={hintStyle}>Nama model yang digunakan. Kosongkan untuk menggunakan default penyedia.</p>
        </div>
        {error && <p style={{ color: '#DC2626', fontSize: '0.875rem', marginBottom: '16px' }}>{error}</p>}
        {saved && <p style={{ color: '#16A34A', fontSize: '0.875rem', marginBottom: '16px' }}>Pengaturan tersimpan.</p>}
        <button onClick={handleSave} style={saveBtnStyle}>Simpan Pengaturan</button>
      </div>
      <div style={{ marginTop: '24px', padding: '16px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E7E5E4' }}>
        <p style={{ fontSize: '0.875rem', color: '#78716C', lineHeight: 1.6 }}>
          Kunci API kamu disimpan secara lokal. Tidak ada data yang dikirim ke server uSeeker.
        </p>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: '#FFFFFF', borderRadius: '12px', padding: '24px', border: '1px solid #E7E5E4', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
const fieldStyle: React.CSSProperties = { marginBottom: '20px' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#1C1917', marginBottom: '4px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #E7E5E4', borderRadius: '8px', fontSize: '1rem', fontFamily: 'system-ui, sans-serif', background: '#FAFAF9', color: '#1C1917', outline: 'none', boxSizing: 'border-box' as const };
const hintStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#78716C', marginTop: '4px', lineHeight: 1.5 };
const saveBtnStyle: React.CSSProperties = { padding: '10px 20px', background: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', width: '100%' };
