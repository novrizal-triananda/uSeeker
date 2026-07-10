/**
 * AI Configuration helper.
 * Reads saved config from Tauri backend (config.json).
 */
import { invoke } from '@tauri-apps/api/core';

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export async function getAiConfig(): Promise<AiConfig> {
  if (!window.__TAURI_INTERNALS__) {
    return { apiKey: '', baseUrl: '', model: '' };
  }
  try {
    const config = await invoke<AiConfig>('get_ai_config');
    return { apiKey: config.apiKey || '', baseUrl: config.baseUrl || '', model: config.model || '' };
  } catch {
    return { apiKey: '', baseUrl: '', model: '' };
  }
}

export async function isAiConfigured(): Promise<boolean> {
  const config = await getAiConfig();
  return config.apiKey.length > 0 && config.model.length > 0;
}

