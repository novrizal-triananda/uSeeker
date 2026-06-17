import { describe, it, expect, vi } from 'vitest';
import {
  extractKeywords,
  generateLocalDiff,
  parseAiSuggestions,
  generateAiSuggestions,
  applyAcceptedSuggestions,
} from '../resumeDiff';
import type { MasterResume, TailoredResume } from '../../types';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core');

// ── Shared test data ────────────────────────────────────────────────────────

const sampleResume: MasterResume = {
  id: 'test-resume',
  sections: [
    {
      type: 'contact',
      title: 'Contact',
      items: [{ text: 'John Doe - Jakarta' }],
    },
    {
      type: 'skills',
      title: 'Skills',
      items: [
        { text: 'React, TypeScript, JavaScript, Node.js' },
        { text: 'Python, Django, PostgreSQL' },
        { text: 'Docker, Git, CI/CD' },
      ],
    },
    {
      type: 'experience',
      title: 'Experience',
      items: [
        { text: 'Frontend Developer at PT Maju Jaya', startDate: 'Jan 2022', endDate: 'Dec 2023' },
        { text: 'Built React applications with TypeScript and Redux' },
        { text: 'Worked with REST APIs and PostgreSQL databases' },
        { text: '3 years of experience in web development' },
      ],
    },
    {
      type: 'education',
      title: 'Education',
      items: [
        { text: 'Bachelor of Computer Science - Universitas Indonesia' },
      ],
    },
  ],
  updatedAt: new Date(),
};

const sampleJD = 'We need a React developer with TypeScript experience. Skills required: React, TypeScript, Node.js, PostgreSQL. Nice to have: Docker, AWS, GraphQL.';

// ── extractKeywords ─────────────────────────────────────────────────────────

describe('extractKeywords', () => {
  it('should extract meaningful keywords from JD', () => {
    const keywords = extractKeywords(sampleJD);
    expect(keywords).toContain('react');
    expect(keywords).toContain('developer');
    expect(keywords).toContain('typescript');
    expect(keywords).toContain('postgresql');
  });

  it('should filter stop words', () => {
    const keywords = extractKeywords('The candidate must be able to work in a fast-paced environment');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('must');
    expect(keywords).not.toContain('able');
  });

  it('should handle empty text', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('should sort by frequency descending', () => {
    const keywords = extractKeywords('React React React TypeScript TypeScript JavaScript');
    expect(keywords[0]).toBe('react');
    expect(keywords[1]).toBe('typescript');
    expect(keywords[2]).toBe('javascript');
  });
});

// ── generateLocalDiff ───────────────────────────────────────────────────────

describe('generateLocalDiff', () => {
  it('should match keywords present in resume', () => {
    const result = generateLocalDiff(sampleResume, sampleJD);
    expect(result.keywordMatch).toContain('react');
    expect(result.keywordMatch).toContain('typescript');
    expect(result.keywordMatch).toContain('postgresql');
    expect(result.keywordMatch).toContain('node');
  });

  it('should identify skill gaps for keywords not in resume', () => {
    const result = generateLocalDiff(sampleResume, sampleJD);
    expect(result.skillGaps).toContain('aws');
    expect(result.skillGaps).toContain('graphql');
    expect(result.skillGaps).not.toContain('react');
  });

  it('should calculate section scores', () => {
    const result = generateLocalDiff(sampleResume, sampleJD);
    expect(result.sectionScores).toHaveProperty('skills');
    expect(result.sectionScores).toHaveProperty('experience');
    expect(result.sectionScores).toHaveProperty('education');
    expect(result.sectionScores).toHaveProperty('contact');
  });

  it('should give skills section highest score for skills-heavy JD', () => {
    const result = generateLocalDiff(sampleResume, sampleJD);
    // Skills section should score higher than education since JD is about skills
    expect(result.sectionScores.skills).toBeGreaterThanOrEqual(result.sectionScores.education);
  });

  it('should score sections 0-100', () => {
    const result = generateLocalDiff(sampleResume, sampleJD);
    for (const score of Object.values(result.sectionScores)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('should handle empty resume sections', () => {
    const emptyResume: MasterResume = {
      id: 'empty',
      sections: [],
      updatedAt: new Date(),
    };
    const result = generateLocalDiff(emptyResume, sampleJD);
    expect(result.keywordMatch).toEqual([]);
    expect(result.skillGaps.length).toBeGreaterThan(0);
    expect(Object.keys(result.sectionScores)).toHaveLength(0);
  });

  it('should handle empty job description', () => {
    const result = generateLocalDiff(sampleResume, '');
    expect(result.keywordMatch).toEqual([]);
    expect(result.skillGaps).toEqual([]);
    expect(result.sectionScores.contact).toBe(0);
  });

  it('should not mutate the master resume', () => {
    const originalSections = JSON.stringify(sampleResume.sections);
    generateLocalDiff(sampleResume, sampleJD);
    expect(JSON.stringify(sampleResume.sections)).toBe(originalSections);
  });

  it('should return deterministic results', () => {
    const result1 = generateLocalDiff(sampleResume, sampleJD);
    const result2 = generateLocalDiff(sampleResume, sampleJD);
    expect(result1.keywordMatch).toEqual(result2.keywordMatch);
    expect(result1.skillGaps).toEqual(result2.skillGaps);
    expect(result1.sectionScores).toEqual(result2.sectionScores);
  });
});

// ── parseAiSuggestions ──────────────────────────────────────────────────────

describe('parseAiSuggestions', () => {
  it('should parse JSON array of suggestions', () => {
    const response = JSON.stringify([
      {
        section: 'skills',
        original: 'React, TypeScript, JavaScript, Node.js',
        suggested: 'React, TypeScript, JavaScript, Node.js, AWS, GraphQL',
        reason: 'Add AWS and GraphQL to match JD requirements',
      },
    ]);
    const result = parseAiSuggestions(response);
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe('skills');
    expect(result[0].original).toBe('React, TypeScript, JavaScript, Node.js');
    expect(result[0].suggested).toBe('React, TypeScript, JavaScript, Node.js, AWS, GraphQL');
    expect(result[0].reason).toBe('Add AWS and GraphQL to match JD requirements');
    expect(result[0].accepted).toBeUndefined();
  });

  it('should parse line-based text format', () => {
    const response = [
      'SECTION: skills',
      'ORIGINAL: React, TypeScript',
      'SUGGESTED: React, TypeScript, AWS',
      'REASON: AWS is required by JD',
      '',
      'SECTION: summary',
      'ORIGINAL: Frontend developer',
      'SUGGESTED: Full-stack developer with cloud experience',
      'REASON: JD mentions full-stack and cloud',
    ].join('\n');

    const result = parseAiSuggestions(response);
    expect(result).toHaveLength(2);
    expect(result[0].section).toBe('skills');
    expect(result[1].section).toBe('summary');
  });

  it('should handle empty response', () => {
    expect(parseAiSuggestions('')).toEqual([]);
    expect(parseAiSuggestions('  ')).toEqual([]);
  });

  it('should handle JSON with missing required fields by filtering them out', () => {
    const response = JSON.stringify([
      { section: 'skills', original: 'React' }, // missing 'suggested'
      { section: 'skills', original: 'React', suggested: 'React, AWS', reason: 'test' },
    ]);
    const result = parseAiSuggestions(response);
    expect(result).toHaveLength(1);
    expect(result[0].suggested).toBe('React, AWS');
  });

  it('should default reason to empty string when missing', () => {
    const response = JSON.stringify([
      { section: 'skills', original: 'React', suggested: 'React, AWS' },
    ]);
    const result = parseAiSuggestions(response);
    expect(result[0].reason).toBe('');
  });

  it('should handle malformed JSON gracefully by trying line-based parsing', () => {
    const response = 'SECTION: skills\nORIGINAL: React\nSUGGESTED: React, AWS';
    const result = parseAiSuggestions(response);
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe('skills');
  });
});

// ── generateAiSuggestions ───────────────────────────────────────────────────

describe('generateAiSuggestions', () => {
  it('should return suggestions on successful API call', async () => {
    const mockSuggestions = [
      {
        section: 'skills',
        original: 'React, TypeScript',
        suggested: 'React, TypeScript, AWS',
        reason: 'Add AWS',
      },
    ];

    vi.mocked(invoke).mockResolvedValue({ result: JSON.stringify(mockSuggestions) });

    const result = await generateAiSuggestions(sampleResume, sampleJD, 'job-1');
    expect(result).toHaveLength(1);
    expect(result![0].section).toBe('skills');

    expect(invoke).toHaveBeenCalledWith('call_ai', expect.objectContaining({
      task: 'resume_tailor',
    }));
  });

  it('should return null when server is down', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('Network error'));

    const result = await generateAiSuggestions(sampleResume, sampleJD, 'job-2');
    expect(result).toBeNull();
  });

  it('should return null when API returns error', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('AI API error (500)'));

    const result = await generateAiSuggestions(sampleResume, sampleJD, 'job-3');
    expect(result).toBeNull();
  });

  it('should not mutate the master resume', async () => {
    const originalSections = JSON.stringify(sampleResume.sections);

    vi.mocked(invoke).mockResolvedValue({ result: '[]' });

    await generateAiSuggestions(sampleResume, sampleJD, 'job-4');
    expect(JSON.stringify(sampleResume.sections)).toBe(originalSections);
  });

  it('should include systemPrompt and task in request', async () => {
    vi.mocked(invoke).mockResolvedValue({ result: '[]' });

    await generateAiSuggestions(sampleResume, sampleJD, 'job-5');

    const callArgs = vi.mocked(invoke).mock.calls[0][1] as any;
    expect(callArgs.systemPrompt).toBeDefined();
    expect(callArgs.task).toBe('resume_tailor');
  });
});

// ── applyAcceptedSuggestions ────────────────────────────────────────────────

describe('applyAcceptedSuggestions', () => {
  it('should apply only accepted suggestions', () => {
    const tailored: TailoredResume = {
      id: 'tailored-1',
      jobId: 'job-1',
      masterResumeId: 'resume-1',
      suggestions: [
        {
          section: 'skills',
          original: 'React, TypeScript',
          suggested: 'React, TypeScript, AWS',
          reason: 'Add AWS',
          accepted: true,
        },
        {
          section: 'skills',
          original: 'Python, Django',
          suggested: 'Python, Django, FastAPI',
          reason: 'Add FastAPI',
          accepted: false,
        },
      ],
      createdAt: new Date(),
    };

    const result = applyAcceptedSuggestions(tailored);
    expect(result).toContain('React, TypeScript, AWS'); // accepted
    expect(result).toContain('Python, Django'); // not accepted, original kept
    expect(result).not.toContain('FastAPI');
  });

  it('should handle null accepted (pending) by keeping original', () => {
    const tailored: TailoredResume = {
      id: 'tailored-2',
      jobId: 'job-1',
      masterResumeId: 'resume-1',
      suggestions: [
        {
          section: 'skills',
          original: 'React, TypeScript',
          suggested: 'React, TypeScript, AWS',
          reason: 'Add AWS',
          accepted: undefined,
        },
      ],
      createdAt: new Date(),
    };

    const result = applyAcceptedSuggestions(tailored);
    expect(result).toContain('React, TypeScript');
    expect(result).not.toContain('AWS');
  });

  it('should include section headers', () => {
    const tailored: TailoredResume = {
      id: 'tailored-3',
      jobId: 'job-1',
      masterResumeId: 'resume-1',
      suggestions: [
        {
          section: 'skills',
          original: 'React',
          suggested: 'React, AWS',
          reason: 'Add AWS',
          accepted: true,
        },
      ],
      createdAt: new Date(),
    };

    const result = applyAcceptedSuggestions(tailored);
    expect(result).toContain('--- SKILLS ---');
  });

  it('should handle empty suggestions', () => {
    const tailored: TailoredResume = {
      id: 'tailored-4',
      jobId: 'job-1',
      masterResumeId: 'resume-1',
      suggestions: [],
      createdAt: new Date(),
    };

    const result = applyAcceptedSuggestions(tailored);
    expect(result).toBe('');
  });

  it('should group suggestions by section in order', () => {
    const tailored: TailoredResume = {
      id: 'tailored-5',
      jobId: 'job-1',
      masterResumeId: 'resume-1',
      suggestions: [
        { section: 'summary', original: 'Old summary', suggested: 'New summary', reason: 'r', accepted: true },
        { section: 'skills', original: 'React', suggested: 'React, AWS', reason: 'r', accepted: true },
      ],
      createdAt: new Date(),
    };

    const result = applyAcceptedSuggestions(tailored);
    const summaryIdx = result.indexOf('--- SUMMARY ---');
    const skillsIdx = result.indexOf('--- SKILLS ---');
    expect(summaryIdx).toBeLessThan(skillsIdx);
  });
});
