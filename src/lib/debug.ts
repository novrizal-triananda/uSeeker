import { parseResumeText } from './cvParser';

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
console.log('Sections count:', result.sections.length);
result.sections.forEach(s => {
  console.log('Section:', s.type, '- items:', s.items.length);
  s.items.forEach((i: any) => console.log('  -', i.text, i.startDate || '', i.endDate || ''));
});
