import { useState } from 'react';

const PROVIDERS = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'custom', label: 'Custom / Self-hosted' },
] as const;

type Provider = (typeof PROVIDERS)[number]['value'];

interface SetupProps {
  onComplete?: () => void;
}

export default function Setup({ onComplete }: SetupProps) {
  const [provider, setProvider] = useState<Provider>('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }

    try {
      // Try Tauri invoke first, fall back to localStorage
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_config', { key: 'provider', value: provider });
        await invoke('save_config', { key: 'api_key', value: apiKey.trim() });
        if (customEndpoint) {
          await invoke('save_config', {
            key: 'custom_endpoint',
            value: customEndpoint.trim(),
          });
        }
      } else {
        localStorage.setItem('useeker_provider', provider);
        localStorage.setItem('useeker_api_key', apiKey.trim());
        if (customEndpoint) {
          localStorage.setItem('useeker_custom_endpoint', customEndpoint.trim());
        }
      }

      setSaved(true);
      setTimeout(() => onComplete?.(), 1000);
    } catch (e) {
      setError(`Failed to save: ${e}`);
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
          <h2 style={styles.title}>Configuration Saved</h2>
          <p style={styles.subtitle}>You're all set to start using uSeeker.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Welcome to uSeeker</h1>
        <p style={styles.subtitle}>
          Configure your AI provider to get started with intelligent job hunting.
        </p>

        <div style={styles.formGroup}>
          <label style={styles.label}>AI Provider</label>
          <select
            style={styles.select}
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>API Key</label>
          <input
            type="password"
            style={styles.input}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setError('');
            }}
            placeholder={`Enter your ${provider} API key`}
          />
        </div>

        {provider === 'custom' && (
          <div style={styles.formGroup}>
            <label style={styles.label}>Custom Endpoint URL</label>
            <input
              type="url"
              style={styles.input}
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="http://localhost:11434/api/generate"
            />
          </div>
        )}

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <button style={styles.saveButton} onClick={handleSave}>
            Save & Continue
          </button>
          <button style={styles.skipButton} onClick={handleSkip}>
            Skip for now
          </button>
        </div>

        <p style={styles.hint}>
          You can configure this later in Settings. Your API key is stored
          locally and never sent to uSeeker.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#0f172a',
    padding: '1rem',
  },
  card: {
    background: '#1e293b',
    borderRadius: '1rem',
    padding: '2.5rem',
    maxWidth: '480px',
    width: '100%',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
  checkmark: {
    fontSize: '3rem',
    textAlign: 'center',
    color: '#22c55e',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#f8fafc',
    margin: '0 0 0.5rem',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: '#94a3b8',
    margin: '0 0 1.5rem',
  },
  formGroup: {
    marginBottom: '1.25rem',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#cbd5e1',
    marginBottom: '0.4rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    width: '100%',
    padding: '0.65rem 0.75rem',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '0.5rem',
    color: '#f8fafc',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '0.65rem 0.75rem',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '0.5rem',
    color: '#f8fafc',
    fontSize: '0.9rem',
    outline: 'none',
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1.5rem',
  },
  saveButton: {
    flex: 1,
    padding: '0.7rem 1rem',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  skipButton: {
    padding: '0.7rem 1rem',
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: '0.5rem',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  error: {
    color: '#ef4444',
    fontSize: '0.85rem',
    margin: '0.5rem 0 0',
  },
  hint: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginTop: '1.25rem',
    textAlign: 'center',
    lineHeight: 1.5,
  },
};
