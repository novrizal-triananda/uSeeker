import http from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env manually (no dotenv dependency)
try {
  const envPath = resolve(import.meta.dirname ?? '.', '..', '.env');
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
      max_tokens: 8192,
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

  // URL fetcher for enrichment research
  if (req.url === '/api/fetch-url' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { url } = JSON.parse(body || '{}');
        if (!url || typeof url !== 'string') {
          jsonResponse(res, 400, { error: 'url is required' });
          return;
        }

        // Validate URL
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          jsonResponse(res, 400, { error: 'Invalid URL' });
          return;
        }

        // Only allow http/https
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          jsonResponse(res, 400, { error: 'Only http/https URLs allowed' });
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; uSeeker/1.0)',
            'Accept': 'text/html,application/xhtml+xml,text/plain',
          },
        });
        clearTimeout(timeout);

        if (!response.ok) {
          jsonResponse(res, 502, { error: `Fetch failed: ${response.status}` });
          return;
        }

        const contentType = response.headers.get('content-type') || '';
        const raw = await response.text();

        let text: string;
        if (contentType.includes('text/html')) {
          // Strip HTML tags, scripts, styles
          text = raw
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[\s\S]*?<\/header>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
        } else {
          text = raw.trim();
        }

        // Limit to ~3000 chars to keep prompts manageable
        if (text.length > 3000) {
          text = text.substring(0, 3000) + '...[truncated]';
        }

        jsonResponse(res, 200, { text, length: text.length });
      } catch (err: any) {
        jsonResponse(res, 500, { error: err.message || 'Failed to fetch URL' });
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
