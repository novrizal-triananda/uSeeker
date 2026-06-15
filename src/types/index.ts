export type SectionType = 'contact' | 'summary' | 'experience' | 'education' | 'skills' | 'certifications' | 'projects' | 'links';
export type ApplicationStatus = 'applied' | 'screen' | 'interview' | 'offer' | 'rejected';
export type ApplicationOutcome = 'accepted' | 'rejected' | 'ghosted' | 'withdrawn';
export type EventType = 'import_cv' | 'add_job' | 'add_application' | 'update_status' | 'generate_score' | 'generate_diff' | 'create_intel' | 'export';

export interface ResumeItem {
  text: string;
  startDate?: string;
  endDate?: string;
  metadata?: Record<string, any>;
}

export interface ResumeSection {
  type: SectionType;
  title: string;
  items: ResumeItem[];
}

export interface MasterResume {
  id: string;
  sections: ResumeSection[];
  updatedAt: Date;
}

export interface JobEntry {
  id: string;
  company: string;
  roleTitle: string;
  sourceUrl?: string;
  companyWebsite?: string;
  careersPage?: string;
  jobDescription: string;
  notes?: string;
  expectedSalary?: string;
  salaryRange?: string;
  createdAt: Date;
}

export interface Application {
  id: string;
  jobId: string;
  company: string;
  roleTitle: string;
  status: ApplicationStatus;
  outcome?: ApplicationOutcome;
  dateApplied: Date;
  lastUpdated: Date;
  notes?: string;
}

export interface FitScore {
  id: string;
  jobId: string;
  overallScore: number;
  skillMatch: number;
  experienceMatch: number;
  preferenceMatch: number;
  matchedSkills: string[];
  missingSkills: string[];
  calculatedAt: Date;
}

export interface CompanyIntel {
  id: string;
  jobId?: string;
  company: string;
  officialUrl: string;
  notes?: string;
  snapshot?: string;
  products?: string[];
  industry?: string;
  redFlags?: string[];
  crawlDepth: number;
  sources: string[];
  createdAt: Date;
}

export interface TailorSuggestion {
  section: string;
  original: string;
  suggested: string;
  reason: string;
  accepted?: boolean;
}

export interface TailoredResume {
  id: string;
  jobId: string;
  masterResumeId: string;
  suggestions: TailorSuggestion[];
  createdAt: Date;
}

export interface EventLog {
  id: string;
  type: EventType;
  timestamp: Date;
  metadata?: Record<string, any>;
}
