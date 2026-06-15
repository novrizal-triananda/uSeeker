import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runAgent } from './agent.js';

// Use public DNS resolvers to bypass ISP DNS hijacking (Indonesia "Internet Positif")
dns.setServers(['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4']);

// Allow fetch to reach sites with invalid/self-signed TLS certs.
// Safe here: local-only app, user-initiated fetch of their own research URLs.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// HTTPS agent that skips certificate verification (for Node.js fetch/undici)
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Resolve hostname via Cloudflare DNS-over-HTTPS (DoH).
 * Bypasses ISP DNS interception by encrypting DNS queries.
 * Returns resolved IP or null on failure.
 */
function resolveViaDoH(hostname: string): Promise<string | null> {
  return new Promise((resolve) => {
    const dohUrl = 'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(hostname) + '&type=A';
    https.get(dohUrl, { agent: insecureAgent, timeout: 5000, headers: { 'Accept': 'application/dns-json' } }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const answer = data?.Answer?.find((a: any) => a.type === 1 && !a.data?.endsWith('.'));
          resolve(answer?.data || null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Fetch DuckDuckGo Lite search results (POST to /lite/).
 * Resolves DNS via DoH to bypass ISP interception.
 * Lite endpoint is more reliable than /html/ for programmatic access.
 */
async function fetchDuckDuckGoHtml(query: string): Promise<string | null> {
  const resolvedIp = await resolveViaDoH('lite.duckduckgo.com');
  const hostname = resolvedIp || 'lite.duckduckgo.com';

  return new Promise((resolve) => {
    const data = new URLSearchParams({ q: query, kl: 'wt-wt' }).toString();
    const options: https.RequestOptions = {
      hostname,
      path: '/lite/',
      method: 'POST',
      agent: insecureAgent,
      timeout: 15000,
      headers: {
        'Host': 'lite.duckduckgo.com',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          console.error(`DuckDuckGo returned status ${res.statusCode}`);
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.error('DuckDuckGo request error:', err.message);
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('DuckDuckGo request timed out');
      resolve(null);
    });

    req.write(data);
    req.end();
  });
}

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

async function callAI(
  messages: { role: string; content: string }[],
): Promise<{ content: string; tokensUsed: number }> {
  if (!AI_API_KEY) {
    throw new Error('AI API key tidak dikonfigurasi. Isi AI_API_KEY di .env');
  }

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
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

/**
 * Fetch and clean text content from a URL.
 * Used by both the fetch-url endpoint and the agent.
 */
async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; uSeeker/1.0)',
        'Accept': 'text/html,application/xhtml+xml,text/plain',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();

    let text: string;
    if (contentType.includes('text/html')) {
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

    if (text.length > 5000) {
      text = text.substring(0, 5000) + '...[truncated]';
    }

    return text;
  } catch {
    return null;
  }
}

// Search API keys (optional — enables fallback providers)
const BRAVE_API_KEY = process.env.BRAVE_API_KEY || '';
const BING_API_KEY = process.env.BING_API_KEY || '';

interface SearchResult {
  title: string;
  url: string;
  content: string;
}

/**
 * DuckDuckGo HTML search — free, unlimited, but blocked by Indonesian ISPs.
 * Returns null if blocked or failed.
 */
async function searchDuckDuckGo(query: string): Promise<SearchResult[] | null> {
  const html = await fetchDuckDuckGoHtml(query);
  if (html === null || html.includes('Internet Positif')) return null;

  const results: SearchResult[] = [];

  // Lite DDG format: <a href="URL" class='result-link'>TITLE</a>
  // Note: href comes BEFORE class in DDG's HTML
  const linkRegex = /<a[^>]+href=['"]([^'"]+)['"][^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    if (results.length >= 5) break;

    let url = match[1] || '';
    const title = match[2].replace(/<[^>]+>/g, '').trim();

    // DDG wraps real URLs in redirect; extract actual URL
    const uddgMatch = url.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      try { url = decodeURIComponent(uddgMatch[1]); } catch { /* keep original */ }
    }
    if (!url || !title || url.startsWith('//')) continue;

    // Extract snippet — in lite format it's in the next <td> after the link
    const linkIdx = match.index;
    const snippetMatch = html.substring(linkIdx, linkIdx + 500).match(/<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/i);
    const content = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    results.push({ title, url, content });
  }

  // Fallback: try /html/ format (multi-class div with result__a)
  if (results.length === 0) {
    const resultBlocks = html.split(/<div[^>]*class="[^"]*\bresult\b[^"]*"[^>]*>/i).slice(1);
    for (const block of resultBlocks) {
      if (results.length >= 5) break;
      const linkMatch = block.match(/<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;

      let url = linkMatch[1] || '';
      const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();

      const uddgMatch = url.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        try { url = decodeURIComponent(uddgMatch[1]); } catch { /* keep original */ }
      }
      if (!url || !title) continue;

      const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
      const content = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      results.push({ title, url, content });
    }
  }

  return results.length > 0 ? results : null;
}

/**
 * Brave Search API — free 2000 queries/month.
 * https://api.search.brave.com/res/v1/web/search
 */
async function searchBrave(query: string): Promise<SearchResult[] | null> {
  if (!BRAVE_API_KEY) return null;
  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY,
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json() as any;
    const webResults = data?.web?.results || [];
    return webResults.slice(0, 5).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      content: r.description || '',
    }));
  } catch {
    return null;
  }
}

/**
 * Bing Web Search API — free 1000 queries/month.
 * https://api.bing.microsoft.com/v7.0/search
 */
async function searchBing(query: string): Promise<SearchResult[] | null> {
  if (!BING_API_KEY) return null;
  try {
    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=5`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Ocp-Apim-Subscription-Key': BING_API_KEY,
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json() as any;
    const webPages = data?.webPages?.value || [];
    return webPages.slice(0, 5).map((r: any) => ({
      title: r.name || '',
      url: r.url || '',
      content: r.snippet || '',
    }));
  } catch {
    return null;
  }
}

/**
 * Multi-provider search with automatic fallback.
 * Order: DuckDuckGo (free/unlimited) → Brave (free 2K/mo) → Bing (free 1K/mo).
 */
async function searchMultiProvider(query: string): Promise<SearchResult[]> {
  // 1. Try DuckDuckGo (free, unlimited — works outside Indonesia)
  const ddgResults = await searchDuckDuckGo(query);
  if (ddgResults) {
    console.log(`Search: DuckDuckGo returned ${ddgResults.length} results`);
    return ddgResults;
  }
  console.log('Search: DuckDuckGo failed/blocked, trying Brave...');

  // 2. Try Brave Search API
  const braveResults = await searchBrave(query);
  if (braveResults) {
    console.log(`Search: Brave returned ${braveResults.length} results`);
    return braveResults;
  }
  console.log('Search: Brave unavailable, trying Bing...');

  // 3. Try Bing Web Search API
  const bingResults = await searchBing(query);
  if (bingResults) {
    console.log(`Search: Bing returned ${bingResults.length} results`);
    return bingResults;
  }
  console.log('Search: All providers failed');

  // 4. All failed — return empty
  return [];
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
      search: {
        providers: [
          { name: 'DuckDuckGo', type: 'free', available: true },
          { name: 'Brave', type: 'api', available: !!BRAVE_API_KEY },
          { name: 'Bing', type: 'api', available: !!BING_API_KEY },
        ],
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

        const messages: { role: string; content: string }[] = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        const { content: result } = await callAI(messages);
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
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
          signal: controller.signal,
          redirect: 'follow',
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

  // Scrape endpoint — returns text + links for multi-page research
  if (req.url === '/api/scrape' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { url } = JSON.parse(body || '{}');
        if (!url || typeof url !== 'string') {
          jsonResponse(res, 400, { error: 'url is required' });
          return;
        }

        let parsed: URL;
        try { parsed = new URL(url); } catch {
          jsonResponse(res, 400, { error: 'Invalid URL' });
          return;
        }
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          jsonResponse(res, 400, { error: 'Only http/https URLs allowed' });
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, {
          signal: controller.signal,
          redirect: 'follow',
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

        // Extract links from raw HTML
        const links: { url: string; text: string }[] = [];
        if (contentType.includes('text/html')) {
          const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
          let m: RegExpExecArray | null;
          const seen = new Set<string>();
          while ((m = linkRegex.exec(raw)) !== null) {
            let href = m[1];
            const text = m[2].trim();
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
            // Resolve relative URLs
            try { href = new URL(href, url).href; } catch { continue; }
            if (seen.has(href)) continue;
            seen.add(href);
            links.push({ url: href, text: text || href });
          }
        }

        // Clean text
        let text: string;
        if (contentType.includes('text/html')) {
          text = raw
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[\s\S]*?<\/header>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ').trim();
        } else {
          text = raw.trim();
        }
        if (text.length > 5000) text = text.substring(0, 5000) + '...[truncated]';

        jsonResponse(res, 200, { text, links: links.slice(0, 30), length: text.length });
      } catch (err: any) {
        jsonResponse(res, 500, { error: err.message || 'Failed to scrape URL' });
      }
    });
    return;
  }

  // Agent endpoint — multi-step AI research
  if (req.url === '/api/agent' && req.method === 'POST') {
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
        const { goal, context, task, maxIterations, enrichmentUrls } = JSON.parse(body || '{}');
        if (!goal) {
          jsonResponse(res, 400, { error: 'goal is required' });
          return;
        }

        // Build context with fetched enrichment URLs
        let enrichedContext = context || '';
        if (enrichmentUrls?.length > 0) {
          const fetchResults = await Promise.allSettled(
            enrichmentUrls.map(async (url: string) => {
              const content = await fetchUrlContent(url);
              return { url, content };
            }),
          );
          for (const r of fetchResults) {
            if (r.status === 'fulfilled' && r.value.content) {
              enrichedContext += `\n\n=== KONTEN DARI ${r.value.url} ===\n${r.value.content}`;
            }
          }
        }

        const result = await runAgent(
          goal,
          enrichedContext,
          task || 'company_research',
          maxIterations || 5,
          callAI,
          fetchUrlContent,
        );

        jsonResponse(res, 200, result);
      } catch (err: any) {
        console.error('Agent error:', err.message);
        jsonResponse(res, 500, { error: err.message });
      }
    });
    return;
  }

  // Multi-provider search endpoint — tries DuckDuckGo → Brave → Bing
  if (req.url === '/api/search' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { query } = JSON.parse(body || '{}');
        if (!query || typeof query !== 'string') {
          jsonResponse(res, 400, { error: 'query is required' });
          return;
        }

        const results = await searchMultiProvider(query);
        jsonResponse(res, 200, { results });
      } catch (err: any) {
        console.error('Search error:', err.message);
        jsonResponse(res, 500, { error: err.message || 'Search failed' });
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
