/**
 * uSeeker AI Agent — Server-side orchestration
 *
 * Runs entirely on the server. API key never leaves this module.
 * Client sends goal → agent iterates with tools → returns final result.
 */

// ── Types ──

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required: boolean }>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
  reasoning: string;
}

export interface AgentStep {
  iteration: number;
  tool: string | null;
  toolInput: any;
  toolOutput: string | null;
  reasoning: string;
}

export interface AgentResult {
  result: string;
  steps: AgentStep[];
  tokensUsed: number;
  duration: number;
  success: boolean;
}

// ── Tool Definitions ──

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'fetch_url',
    description: 'Fetch dan ekstrak konten teks dari sebuah URL. Cocok untuk mengambil halaman web, artikel, atau dokumen publik.',
    parameters: {
      url: { type: 'string', description: 'URL yang akan di-fetch', required: true },
    },
  },
  {
    name: 'extract_links',
    description: 'Ekstrak semua link dari HTML. Berguna untuk menemukan halaman terkait (artikel, berita, halaman produk).',
    parameters: {
      html: { type: 'string', description: 'Raw HTML yang sudah di-fetch', required: true },
      filter: { type: 'string', description: 'Keyword untuk filter link (opsional)', required: false },
    },
  },
];

// ── System Prompts ──

function getAgentSystemPrompt(task: string): string {
  const base = `Kamu adalah AI Agent yang bekerja untuk pencari kerja Indonesia.
Tugasmu: mencapai goal yang diberikan dengan cara yang paling efektif.

CARA KERJA:
1. Analisa goal dan tentukan langkah pertama
2. Kalau butuh informasi dari internet, gunakan tool yang tersedia
3. Evaluasi hasil — apakah sudah cukup? Kalau belum, ambil langkah berikutnya
4. Ulangi sampai goal tercapai atau maksimum iterasi

OUTPUT FORMAT:
Kamu HARUS respond dalam format JSON yang valid. Pilih SATU dari dua format:

Format 1 — Gunakan tool:
{
  "action": "tool",
  "tool": "nama_tool",
  "arguments": { "param": "value" },
  "reasoning": "Mengapa saya menggunakan tool ini"
}

Format 2 — Selesai (final answer):
{
  "action": "final",
  "result": "Jawaban final yang lengkap dan terstruktur"
}

ATURAN PENTING:
- Jangan mengarang informasi. Gunakan tool untuk mendapatkan data nyata.
- Kalau tool gagal, coba URL alternatif atau methods lain.
- Batasi diri ke MAXIMUM ${10} iterasi.
- Setiap fetch harus punya tujuan jelas.
- Output final HARUS dalam Bahasa Indonesia.`;

  if (task === 'company_research') {
    return base + `

SPESIFIK UNTUK RISET PERUSAHAAN:
Goal: Analisis mendalam tentang perusahaan untuk membantu pencari kerja.

Informasi yang perlu dikumpulkan:
1. Sejarah & profil perusahaan
2. Produk/layanan utama
3. Industri & posisi pasar
4. Budaya kerja
5. Red flags (jika ada)
6. Tips wawancara

Strategi:
- Fetch website resmi perusahaan
- Cari artikel berita terkait
- Ekstrak informasi dari setiap sumber
- Sintesis semua data ke laporan komprehensif`;
  }

  return base;
}

// ── Tool Execution ──

async function executeTool(
  name: string,
  args: Record<string, any>,
  fetchUrlFn: (url: string) => Promise<string | null>,
): Promise<{ output: string; success: boolean }> {
  try {
    switch (name) {
      case 'fetch_url': {
        if (!args.url) return { output: 'Error: url is required', success: false };
        const content = await fetchUrlFn(args.url);
        if (!content) return { output: `Gagal mengambil konten dari ${args.url}`, success: false };
        // Truncate if too long for context
        const truncated = content.length > 5000
          ? content.slice(0, 5000) + '\n...[truncated]'
          : content;
        return { output: truncated, success: true };
      }

      case 'extract_links': {
        if (!args.html) return { output: 'Error: html is required', success: false };
        const links = extractLinks(args.html, args.filter);
        return { output: JSON.stringify(links, null, 2), success: true };
      }

      default:
        return { output: `Unknown tool: ${name}`, success: false };
    }
  } catch (err: any) {
    return { output: `Tool error: ${err.message}`, success: false };
  }
}

function extractLinks(html: string, filter?: string): { url: string; text: string }[] {
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  const links: { url: string; text: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2].trim();
    if (!url || url.startsWith('#') || url.startsWith('javascript:')) continue;
    if (filter && !url.toLowerCase().includes(filter.toLowerCase()) &&
        !text.toLowerCase().includes(filter.toLowerCase())) continue;
    links.push({ url, text: text || url });
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return links.filter(l => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  }).slice(0, 20); // Max 20 links
}

// ── Agent Loop ──

/**
 * Run the agent loop. Sends goal to LLM, executes tools, iterates.
 *
 * @param goal - What the agent should accomplish
 * @param context - Additional context (CV, JD, etc.)
 * @param task - Task type for prompt selection
 * @param maxIterations - Max loop iterations (default 5, max 10)
 * @param callAI - Function to call the AI API
 * @param fetchUrlFn - Function to fetch URL content
 */
export async function runAgent(
  goal: string,
  context: string,
  task: string,
  maxIterations: number,
  callAI: (messages: { role: string; content: string }[]) => Promise<{ content: string; tokensUsed: number }>,
  fetchUrlFn: (url: string) => Promise<string | null>,
): Promise<AgentResult> {
  const startTime = Date.now();
  const safeMax = Math.min(Math.max(maxIterations, 1), 10);
  const steps: AgentStep[] = [];
  let totalTokens = 0;

  const systemPrompt = getAgentSystemPrompt(task);
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `GOAL: ${goal}\n\nKONTEKS:\n${context || '(tidak ada konteks tambahan)'}\n\nTools yang tersedia:\n${AGENT_TOOLS.map(t => `- ${t.name}: ${t.description}`).join('\n')}\n\nMulai sekarang. Gunakan tool jika perlu, atau langsung berikan jawaban final.`,
    },
  ];

  for (let i = 0; i < safeMax; i++) {
    // Call LLM
    let response: { content: string; tokensUsed: number };
    try {
      response = await callAI(messages);
    } catch (err: any) {
      return {
        result: `Agent error: ${err.message}`,
        steps,
        tokensUsed: totalTokens,
        duration: Date.now() - startTime,
        success: false,
      };
    }
    totalTokens += response.tokensUsed;

    // Parse response
    let parsed: any;
    try {
      // Strip markdown fences if present
      const cleaned = response.content
        .replace(/```json?\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Not JSON — treat as final answer (model didn't follow format)
      return {
        result: response.content,
        steps,
        tokensUsed: totalTokens,
        duration: Date.now() - startTime,
        success: true,
      };
    }

    // Final answer
    if (parsed.action === 'final' || !parsed.action) {
      return {
        result: parsed.result || response.content,
        steps,
        tokensUsed: totalTokens,
        duration: Date.now() - startTime,
        success: true,
      };
    }

    // Tool call
    if (parsed.action === 'tool' && parsed.tool) {
      const toolResult = await executeTool(
        parsed.tool,
        parsed.arguments || {},
        fetchUrlFn,
      );

      steps.push({
        iteration: i,
        tool: parsed.tool,
        toolInput: parsed.arguments || {},
        toolOutput: toolResult.output.slice(0, 500), // Log trimmed version
        reasoning: parsed.reasoning || '',
      });

      // Add assistant message (tool call) and tool result to conversation
      messages.push({
        role: 'assistant',
        content: response.content,
      });
      messages.push({
        role: 'user',
        content: `Tool "${parsed.tool}" result:\n\n${toolResult.output}\n\nEvaluasi: apakah informasi ini cukup untuk menjawab goal? Kalau belum cukup, ambil langkah berikutnya. Kalau sudah cukup, berikan jawaban final.`,
      });
    }
  }

  // Max iterations reached — synthesize what we have
  return {
    result: `Maksimum iterasi (${safeMax}) tercapai. Berikut ringkasan dari ${steps.length} langkah yang dilakukan:\n\n` +
      steps.map(s => `**Langkah ${s.iteration + 1}:** ${s.reasoning}`).join('\n\n') +
      '\n\nSilakan lakukan riset manual untuk informasi yang masih kurang.',
    steps,
    tokensUsed: totalTokens,
    duration: Date.now() - startTime,
    success: false,
  };
}
