import http from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env manually (no dotenv dependency)
try {
  const envPath = resolve(import.meta.dirname ?? '.', '.env');
  const envText = readFileSync(envPath, 'utf8');
  for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch { /* .env optional */ }

const PORT = Number(process.env.USEEKER_API_PORT) || 8787;

// AI provider config — backward-compatible: falls back to Deepseek defaults
const AI_API_KEY = process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const AI_BASE_URL = (process.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';

function cors(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function jsonResponse(res: http.ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function callAI(prompt: string, systemPrompt?: string): Promise<string> {
  if (!AI_API_KEY) {
    throw new Error('AI API key tidak dikonfigurasi. Isi AI_API_KEY di .env');
  }

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI API error (${response.status}): ${err}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

const server = http.createServer(async (req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/api/health' && req.method === 'GET') {
    jsonResponse(res, 200, {
      status: 'ok',
      ai: {
        configured: !!AI_API_KEY,
        provider: AI_API_KEY ? AI_BASE_URL : null,
        model: AI_API_KEY ? AI_MODEL : null,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // AI proxy endpoint
  if (req.url === '/api/ai' && req.method === 'POST') {
    const allowCloud = process.env.USEEKER_ALLOW_CLOUD_AI === 'true';
    if (!allowCloud) {
      jsonResponse(res, 403, {
        error: 'Cloud AI dinonaktifkan. Aktifkan USEEKER_ALLOW_CLOUD_AI=true di .env',
      });
      return;
    }

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { prompt, systemPrompt, task } = JSON.parse(body || '{}');
        if (!prompt) {
          jsonResponse(res, 400, { error: 'prompt is required' });
          return;
        }

        const result = await callAI(prompt, systemPrompt);
        jsonResponse(res, 200, { result, task });
      } catch (err: any) {
        console.error('AI proxy error:', err.message);
        jsonResponse(res, 500, { error: err.message });
      }
    });
    return;
  }

  jsonResponse(res, 404, { error: 'Not Found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`uSeeker API berjalan di http://127.0.0.1:${PORT}`);
  console.log(`AI provider: ${AI_API_KEY ? `${AI_BASE_URL} (${AI_MODEL})` : 'NOT SET'}`);
});
