import { useState } from 'react';

interface SetupProps {
  onComplete?: () => void;
}

export default function Setup({ onComplete }: SetupProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('API key wajib diisi');
      return;
    }
    if (!baseUrl.trim()) {
      setError('Base URL wajib diisi');
      return;
    }
    if (!model.trim()) {
      setError('Nama model wajib diisi');
      return;
    }

    try {
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_config', { key: 'api_key', value: apiKey.trim() });
        await invoke('save_config', { key: 'base_url', value: baseUrl.trim().replace(/\/\/+$/, '') });
        await invoke('save_config', { key: 'model', value: model.trim() });
      } else {
        localStorage.setItem('useeker_api_key', apiKey.trim());
        localStorage.setItem('useeker_base_url', baseUrl.trim().replace(/\/\/+$/, ''));
        localStorage.setItem('useeker_model', model.trim());
      }

      setSaved(true);
      setTimeout(() => onComplete?.(), 1000);
    } catch (e) {
      setError('Gagal menyimpan: ' + String(e));
    }
  };

  const handleSkip = () => {
    onComplete?.();
  };

  if (saved) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.checkmark}>✓</div>
          <h2 style={styles.title}>Konfigurasi Tersimpan</h2>
          <p style={styles.subtitle}>Siap digunakan.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Selamat Datang di uSeeker</h1>
        <p style={styles.subtitle}>
          Masukkan pengaturan penyedia AI kamu untuk memulai.
        </p>

        <div style={styles.formGroup}>
          <label style={styles.label}>Base URL</label>
          <input type="text" style={styles.input} value={baseUrl}
            onChange={(e) => { setBaseUrl(e.target.value); setError(''); }}
            placeholder="https://api.deepseek.com" />
          <p style={styles.hint}>Contoh: https://api.deepseek.com, https://openrouter.ai/api/v1</p>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>API Key</label>
          <input type="password" style={styles.input} value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setError(''); }}
            placeholder="sk-..." />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Model</label>
          <input type="text" style={styles.input} value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="deepseek-chat" />
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <button style={styles.saveButton} onClick={handleSave}>
            Save & Continue
          </button>
          <button style={styles.skipButton} onClick={handleSkip}>
            Lewati
          </button>
        </div>

        <p style={styles.hint}>
          Pengaturan bisa diubah kapan saja dari menu Pengaturan.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-bg, #FAFAF9)', padding: '1rem' },
  card: { background: 'var(--color-surface, #FFFFFF)', borderRadius: 'var(--radius-lg, 12px)', padding: '2.5rem', maxWidth: '480px', width: '100%', boxShadow: 'var(--shadow-md, 0 4px 6px rgba(0,0,0,0.07))', border: '1px solid var(--color-border, #E7E5E4)' },
  checkmark: { fontSize: '3rem', textAlign: 'center', color: 'var(--color-status-green, #16A34A)', marginBottom: '0.5rem' },
  title: { fontSize: 'var(--font-size-2xl, 1.5rem)', fontWeight: 700, color: 'var(--color-text, #1C1917)', margin: '0 0 0.5rem' },
  subtitle: { fontSize: 'var(--font-size-sm, 0.875rem)', color: 'var(--color-text-muted, #78716C)', margin: '0 0 1.5rem', lineHeight: 1.5 },
  formGroup: { marginBottom: '1.25rem' },
  label: { display: 'block', fontSize: 'var(--font-size-sm, 0.875rem)', fontWeight: 600, color: 'var(--color-text, #1C1917)', marginBottom: '0.4rem' },
  input: { width: '100%', padding: '10px 12px', background: 'var(--color-bg, #FAFAF9)', border: '1px solid var(--color-border, #E7E5E4)', borderRadius: 'var(--radius-md, 8px)', color: 'var(--color-text, #1C1917)', fontSize: 'var(--font-size-base, 1rem)', fontFamily: 'var(--font-family, system-ui, sans-serif)', outline: 'none', boxSizing: 'border-box' },
  actions: { display: 'flex', gap: '0.75rem', marginTop: '1.5rem' },
  saveButton: { flex: 1, padding: '10px 16px', background: 'var(--color-primary, #2563EB)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontSize: 'var(--font-size-sm, 0.875rem)', fontWeight: 600, cursor: 'pointer' },
  skipButton: { padding: '10px 16px', background: 'transparent', color: 'var(--color-text-muted, #78716C)', border: '1px solid var(--color-border, #E7E5E4)', borderRadius: 'var(--radius-md, 8px)', fontSize: 'var(--font-size-sm, 0.875rem)', cursor: 'pointer' },
  error: { color: 'var(--color-status-red, #DC2626)', fontSize: 'var(--font-size-sm, 0.875rem)', margin: '0.5rem 0 0' },
  hint: { fontSize: '0.75rem', color: 'var(--color-text-muted, #78716C)', marginTop: '4px', lineHeight: 1.5 },
};

