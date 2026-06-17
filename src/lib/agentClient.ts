/**
 * Client-side agent caller.
 * Sends research goals to the Tauri backend agent loop.
 * API key never leaves the app.
 */

import { invoke } from '@tauri-apps/api/core';

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
  return invoke<AgentResult>('run_agent', {
    goal: `Riset mendalam tentang perusahaan "${company}". Website resmi: ${officialUrl || '(tidak ada)'}`,
    context: `Perusahaan: ${company}\nWebsite: ${officialUrl}`,
    task: 'company_research',
    maxIterations,
    enrichmentUrls,
  });
}
