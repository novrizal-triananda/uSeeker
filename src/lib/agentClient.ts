/**
 * Client-side agent caller.
 * Sends research goals to the server-side agent loop.
 * API key never leaves the server.
 */

const API_BASE = 'http://127.0.0.1:8787';

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

/**
 * Run the deep research agent for a company.
 * Multi-step: fetches URLs, extracts links, synthesizes findings.
 */
export async function runDeepResearch(
  company: string,
  officialUrl: string,
  enrichmentUrls: string[] = [],
  maxIterations: number = 5,
): Promise<AgentResult> {
  const response = await fetch(`${API_BASE}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: `Riset mendalam tentang perusahaan "${company}". Website resmi: ${officialUrl || '(tidak ada)'}`,
      context: `Perusahaan: ${company}\nWebsite: ${officialUrl}`,
      task: 'company_research',
      maxIterations,
      enrichmentUrls,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Agent error: ${response.status}`);
  }

  return response.json();
}
