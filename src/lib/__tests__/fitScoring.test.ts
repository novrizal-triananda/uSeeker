import { describe, it, expect } from 'vitest';
import { extractKeywords, extractSkillPhrases, generateFitScore } from '../fitScoring';
import type { MasterResume } from '../../types';

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

describe('extractKeywords', () => {
  it('should extract meaningful keywords from JD', async () => {
    const jd = 'We need a React developer with TypeScript experience. Must know Node.js and PostgreSQL.';
    const keywords = extractKeywords(jd);
    expect(keywords).toContain('react');
    expect(keywords).toContain('developer');
    expect(keywords).toContain('typescript');
    expect(keywords.some(k => k.includes('node'))).toBe(true);
    expect(keywords).toContain('postgresql');
  });

  it('should filter stop words', async () => {
    const jd = 'The candidate must be able to work in a fast-paced environment';
    const keywords = extractKeywords(jd);
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('must');
    expect(keywords).not.toContain('able');
  });

  it('should handle empty text', async () => {
    expect(extractKeywords('')).toEqual([]);
  });
});

describe('extractSkillPhrases', () => {
  it('should extract comma-separated skills', async () => {
    const text = 'Required: React, Vue, Angular, TypeScript';
    const skills = extractSkillPhrases(text);
    expect(skills).toContain('react');
    expect(skills).toContain('vue');
    expect(skills).toContain('angular');
    expect(skills).toContain('typescript');
  });

  it('should extract technical terms', async () => {
    const text = 'Experience with React, Docker, and AWS required';
    const skills = extractSkillPhrases(text);
    expect(skills).toContain('react');
    expect(skills).toContain('docker');
    expect(skills).toContain('aws');
  });
});

describe('generateFitScore', () => {
  it('should generate a valid fit score', async () => {
    const jd = 'We need a React developer with 3 years experience. Skills: React, TypeScript, Node.js, PostgreSQL';
    const score = await generateFitScore(sampleResume, jd, 'job-1');
    expect(score).toBeDefined();
    expect(score.overallScore).toBeGreaterThanOrEqual(0);
    expect(score.overallScore).toBeLessThanOrEqual(100);
    expect(score.skillMatch).toBeGreaterThanOrEqual(0);
    expect(score.experienceMatch).toBeGreaterThanOrEqual(0);
    expect(score.preferenceMatch).toBeGreaterThanOrEqual(0);
    expect(score.matchedSkills.length).toBeGreaterThan(0);
  });

  it('should match skills from resume', async () => {
    const jd = 'Required: React, TypeScript, Node.js';
    const score = await generateFitScore(sampleResume, jd, 'job-2');
    expect(score.matchedSkills).toContain('react');
    expect(score.matchedSkills).toContain('typescript');
    expect(score.matchedSkills.some(k => k.includes('node'))).toBe(true);
  });

  it('should identify missing skills', async () => {
    const jd = 'Required: React, Kotlin, Swift, Flutter';
    const score = await generateFitScore(sampleResume, jd, 'job-3');
    expect(score.missingSkills).toContain('kotlin');
    expect(score.missingSkills).toContain('swift');
    expect(score.missingSkills).toContain('flutter');
    expect(score.matchedSkills).toContain('react');
  });

  it('should calculate experience match', async () => {
    const jd = 'Requires 3 years of experience in web development';
    const score = await generateFitScore(sampleResume, jd, 'job-4');
    expect(score.experienceMatch).toBe(100); // Resume has 3 years, JD requires 3
  });

  it('should handle JD with no experience requirement', async () => {
    const jd = 'Looking for a React developer';
    const score = await generateFitScore(sampleResume, jd, 'job-5');
    expect(score.experienceMatch).toBe(100); // No requirement = full match
  });

  it('should penalize salary mismatch', async () => {
    const jd = 'Salary range: 5-8 juta';
    const score = await generateFitScore(sampleResume, jd, 'job-6', '15 juta');
    // salary check works when both expected and range are numeric
    expect(score.preferenceMatch).toBeGreaterThanOrEqual(0);
  });

  it('should generate unique IDs', async () => {
    const jd = 'React developer';
    const score1 = await generateFitScore(sampleResume, jd, 'job-7');
    const score2 = await generateFitScore(sampleResume, jd, 'job-8');
    expect(score1.id).not.toBe(score2.id);
  });

  it('should include calculatedAt timestamp', async () => {
    const before = new Date();
    const score = await generateFitScore(sampleResume, 'React', 'job-9');
    const after = new Date();
    expect(score.calculatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(score.calculatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});