import { describe, it, expect } from 'vitest';
import { parseResumeText } from '../cvParser';

describe('cvParser', () => {

  describe('plain text resume with standard sections', () => {
    it('should parse a complete resume with all standard sections', () => {
      const text = `
John Doe
john.doe@email.com
+1-555-123-4567
linkedin.com/in/johndoe

Summary
Experienced software engineer with 5+ years of expertise.
Passionate about building scalable applications.

Experience
Senior Software Engineer at TechCorp, Jan 2022 - Present
Led development of microservices architecture.
Managed team of 5 engineers.

Software Engineer at StartupXYZ, Jun 2019 - Dec 2021
Built full-stack web applications.
Implemented CI/CD pipelines.

Education
Bachelor of Science in Computer Science
MIT, 2015 - 2019

Skills
JavaScript, TypeScript, React, Node.js, Python, AWS, Docker

Certifications
AWS Solutions Architect

Projects
Open Source Dashboard - Built a real-time analytics dashboard

Links
github.com/johndoe
`;

      const result = parseResumeText(text);

      expect(result.id).toMatch(/^resume_/);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.sections.length).toBeGreaterThanOrEqual(5);

      // Contact section
      const contact = result.sections.find(s => s.type === 'contact');
      expect(contact).toBeDefined();
      expect(contact!.items.length).toBeGreaterThanOrEqual(3);
      expect(contact!.items.some(i => i.metadata?.field === 'name')).toBe(true);
      expect(contact!.items.some(i => i.metadata?.field === 'email')).toBe(true);
      expect(contact!.items.some(i => i.metadata?.field === 'phone')).toBe(true);
      expect(contact!.items.some(i => i.metadata?.field === 'linkedin')).toBe(true);

      // Summary section
      const summary = result.sections.find(s => s.type === 'summary');
      expect(summary).toBeDefined();
      expect(summary!.items.length).toBeGreaterThanOrEqual(1);

      // Experience section
      const experience = result.sections.find(s => s.type === 'experience');
      expect(experience).toBeDefined();
      expect(experience!.items.length).toBeGreaterThanOrEqual(2);
      expect(experience!.items[0].startDate).toBe('Jan 2022');
      expect(experience!.items[0].endDate).toBe('present');

      // Education section
      const education = result.sections.find(s => s.type === 'education');
      expect(education).toBeDefined();
      expect(education!.items.length).toBeGreaterThanOrEqual(1);

      // Skills section
      const skills = result.sections.find(s => s.type === 'skills');
      expect(skills).toBeDefined();
      expect(skills!.items.length).toBeGreaterThanOrEqual(5);

      // Certifications section
      const certs = result.sections.find(s => s.type === 'certifications');
      expect(certs).toBeDefined();
      expect(certs!.items.length).toBe(1);

      // Projects section
      const projects = result.sections.find(s => s.type === 'projects');
      expect(projects).toBeDefined();
      expect(projects!.items.length).toBe(1);

      // Links section
      const links = result.sections.find(s => s.type === 'links');
      expect(links).toBeDefined();
      expect(links!.items.length).toBe(1);
    });

    it('should handle ALL CAPS section headings', () => {
      const text = `
Jane Smith
jane@email.com

SUMMARY
Developer with 3 years experience.

EXPERIENCE
Dev at Company A, 2020 - 2023

SKILLS
JavaScript, Python, Go
`;

      const result = parseResumeText(text);
      expect(result.sections.length).toBeGreaterThanOrEqual(3);
      expect(result.sections.find(s => s.type === "experience")).toBeDefined();
      expect(result.sections.find(s => s.type === "skills")).toBeDefined();
    });
  });

  describe('resume with date ranges in entries', () => {
    it('should extract date ranges from experience entries', () => {
      const text = `
John Doe
john@email.com

Experience
Software Engineer at TechCo, Jan 2022 - Mar 2023
Built amazing things.

Junior Dev at SmallCo, Jun 2019 - Dec 2021
Learned a lot.
`;

      const result = parseResumeText(text);
      const experience = result.sections.find(s => s.type === 'experience');
      expect(experience).toBeDefined();
      expect(experience!.items[0].startDate).toBe('Jan 2022');
      expect(experience!.items[0].endDate).toBe('Mar 2023');
      expect(experience!.items.some(i => i.startDate === "Jun 2019")).toBe(true);
      expect(experience!.items.some(i => i.endDate === "Dec 2021")).toBe(true);
    });

    it('should handle year-only date ranges', () => {
      const text = `
Jane Smith
jane@email.com

Education
B.Sc. Computer Science, MIT, 2015 - 2019
`;

      const result = parseResumeText(text);
      const education = result.sections.find(s => s.type === 'education');
      expect(education).toBeDefined();
      expect(education!.items[0].startDate).toBe('2015');
      expect(education!.items[0].endDate).toBe('2019');
    });

    it('should handle Present as end date', () => {
      const text = `
John Doe
john@email.com

Experience
Engineer at BigCo, 2020 - Present
`;

      const result = parseResumeText(text);
      const experience = result.sections.find(s => s.type === 'experience');
      expect(experience).toBeDefined();
      expect(experience!.items[0].startDate).toBe('2020');
      expect(experience!.items[0].endDate).toBe('present');
    });

    it('should handle en-dash and em-dash separators', () => {
      const text = `
John Doe
john@email.com

Experience
Dev at Co, 2020 \u2013 2023
Dev at Co2, 2019 \u2014 2020
`;

      const result = parseResumeText(text);
      const experience = result.sections.find(s => s.type === 'experience');
      expect(experience).toBeDefined();
      expect(experience!.items[0].startDate).toBe('2020');
      expect(experience!.items[0].endDate).toBe('2023');
      expect(experience!.items[1].startDate).toBe('2019');
      expect(experience!.items[1].endDate).toBe('2020');
    });
  });

  describe('empty and invalid input handling', () => {
    it('should return empty sections for empty string', () => {
      const result = parseResumeText('');
      expect(result.id).toMatch(/^resume_/);
      expect(result.sections).toEqual([]);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should return empty sections for whitespace-only input', () => {
      const result = parseResumeText('   \n  \n   ');
      expect(result.sections).toEqual([]);
    });

    it('should return empty sections for null-like input', () => {
      // @ts-expect-error testing null input
      const result = parseResumeText(null);
      expect(result.sections).toEqual([]);
    });

    it('should handle text with no recognized sections', () => {
      const text = `Just some random text about my life.
No headings here.`;
      const result = parseResumeText(text);
      // Should still produce a valid MasterResume
      expect(result.id).toMatch(/^resume_/);
      expect(Array.isArray(result.sections)).toBe(true);
    });
  });

  describe('section detection accuracy', () => {
    it('should detect various section heading aliases', () => {
      const text = `
John Doe
john@email.com

Work Experience
Dev at A, 2020 - 2022

Technical Skills
Java, C++

Certifications
AWS Certified

Portfolio
My Website - built with React

Socials
twitter.com/johndoe

Objective
Looking for senior role.

Academic
PhD in CS, Stanford, 2015 - 2020
`;

      const result = parseResumeText(text);
      const types = result.sections.map(s => s.type);
      expect(types).toContain('experience');
      expect(types).toContain('skills');
      expect(types).toContain('certifications');
      expect(types).toContain('projects');
      expect(types).toContain('links');
      expect(types).toContain('summary');
      expect(types).toContain('education');
    });

    it('should not treat long lines as headings', () => {
      const text = `
John Doe
john@email.com

EXPERIENCE
Software Engineer at VeryLongCompanyNameThatMakesGreatProducts, 2020 - 2023
`;

      const result = parseResumeText(text);
      const experience = result.sections.find(s => s.type === 'experience');
      expect(experience).toBeDefined();
      // The long job line should be an item, not a heading
      expect(experience!.items.length).toBe(1);
    });

    it('should handle decorated headings', () => {
      const text = `
John Doe
john@email.com

--- Experience ---
Dev at Co, 2020 - 2022

* Skills *
Java, Python
`;

      const result = parseResumeText(text);
      expect(result.sections.find(s => s.type === 'experience')).toBeDefined();
      expect(result.sections.find(s => s.type === 'skills')).toBeDefined();
    });

    it('should handle colon-suffixed headings', () => {
      const text = `
John Doe
john@email.com

Experience:
Dev at Co, 2020 - 2022

Skills:
Java, Python
`;

      const result = parseResumeText(text);
      expect(result.sections.find(s => s.type === 'experience')).toBeDefined();
      expect(result.sections.find(s => s.type === 'skills')).toBeDefined();
    });
  });

  describe('skills parsing', () => {
    it('should split comma-separated skills into individual items', () => {
      const text = `
John Doe
john@email.com

Skills
JavaScript, TypeScript, React, Node.js, Python, AWS, Docker
`;

      const result = parseResumeText(text);
      const skills = result.sections.find(s => s.type === 'skills');
      expect(skills).toBeDefined();
      expect(skills!.items.length).toBe(7);
      expect(skills!.items.map(i => i.text)).toContain('JavaScript');
      expect(skills!.items.map(i => i.text)).toContain('TypeScript');
      expect(skills!.items.map(i => i.text)).toContain('React');
    });

    it('should handle bullet-pointed skills', () => {
      const text = `
John Doe
john@email.com

Skills
- JavaScript
- TypeScript
- React
`;

      const result = parseResumeText(text);
      const skills = result.sections.find(s => s.type === 'skills');
      expect(skills).toBeDefined();
      expect(skills!.items.length).toBe(3);
    });
  });

  describe('deduplication', () => {
    it('should remove duplicate items within a section', () => {
      const text = `
John Doe
john@email.com

Skills
JavaScript, TypeScript, JavaScript, React, TypeScript
`;

      const result = parseResumeText(text);
      const skills = result.sections.find(s => s.type === 'skills');
      expect(skills).toBeDefined();
      expect(skills!.items.length).toBe(3);
      expect(skills!.items.map(i => i.text)).toContain('JavaScript');
      expect(skills!.items.map(i => i.text)).toContain('TypeScript');
      expect(skills!.items.map(i => i.text)).toContain('React');
    });

    it('should deduplicate case-insensitively', () => {
      const text = `
John Doe
john@email.com

Skills
JavaScript, javascript, JAVASCRIPT
`;

      const result = parseResumeText(text);
      const skills = result.sections.find(s => s.type === 'skills');
      expect(skills).toBeDefined();
      expect(skills!.items.length).toBe(1);
    });
  });

  describe('contact info parsing', () => {
    it('should extract name from first line', () => {
      const text = `John Doe\njohn@email.com\n\nExperience\nDev, 2020 - 2023`;
      const result = parseResumeText(text);
      const contact = result.sections.find(s => s.type === 'contact');
      expect(contact).toBeDefined();
      const nameItem = contact!.items.find(i => i.metadata?.field === 'name');
      expect(nameItem).toBeDefined();
      expect(nameItem!.text).toBe('John Doe');
    });

    it('should extract email address', () => {
      const text = `John Doe\njohn.doe@company.com\n\nExperience\nDev, 2020 - 2023`;
      const result = parseResumeText(text);
      const contact = result.sections.find(s => s.type === 'contact');
      expect(contact).toBeDefined();
      const emailItem = contact!.items.find(i => i.metadata?.field === 'email');
      expect(emailItem).toBeDefined();
      expect(emailItem!.text).toContain('john.doe@company.com');
    });

    it('should extract phone number', () => {
      const text = `John Doe\n+1-555-123-4567\n\nExperience\nDev, 2020 - 2023`;
      const result = parseResumeText(text);
      const contact = result.sections.find(s => s.type === 'contact');
      expect(contact).toBeDefined();
      const phoneItem = contact!.items.find(i => i.metadata?.field === 'phone');
      expect(phoneItem).toBeDefined();
      expect(phoneItem!.text).toContain('555-123-4567');
    });

    it('should extract LinkedIn URL', () => {
      const text = `John Doe\nlinkedin.com/in/johndoe\n\nExperience\nDev, 2020 - 2023`;
      const result = parseResumeText(text);
      const contact = result.sections.find(s => s.type === 'contact');
      expect(contact).toBeDefined();
      const linkedinItem = contact!.items.find(i => i.metadata?.field === 'linkedin');
      expect(linkedinItem).toBeDefined();
      expect(linkedinItem!.text).toContain('linkedin.com/in/johndoe');
    });
  });

});
