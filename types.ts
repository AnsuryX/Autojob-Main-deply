
export interface ResumeJson {
  summary: string;
  skills: string[];
  experience: Experience[];
  projects: Project[];
}

export interface ResumeTrack {
  id: string;
  name: string;
  content: ResumeJson;
}

export interface Experience {
  company: string;
  role: string;
  duration: string;
  achievements: string[];
}

export interface Project {
  name: string;
  description: string;
  technologies: string[];
}

export interface ResumeMutation {
  mutatedResume: ResumeJson;
  report: {
    selectedTrackId?: string;
    selectedTrackName?: string;
    keywordsInjected: string[];
    mirroredPhrases?: { original: string; mirrored: string }[];
    reorderingJustification?: string;
    atsScoreEstimate: number;
    iterationCount?: number;
    timings?: {
      mutationMs: number;
      analysisMs: number;
    };
  };
}

export interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  linkedin: string;
  portfolio: string;
  resumeTracks: ResumeTrack[];
  preferences: {
    targetRoles: string[];
    minSalary: string;
    locations: string[];
    remoteOnly: boolean;
    matchThreshold: number;
    preferredPlatforms: string[];
  };
}

// Added missing Job interface to fix errors in services/gemini.ts and components/JobHunter.tsx
export interface Job {
  id: string;
  scrapedAt: string;
  title: string;
  company: string;
  location: string;
  skills: string[];
  description: string;
  applyUrl: string;
  platform: string;
}

export interface Gig {
  id: string;
  title: string;
  platform: 'Upwork' | 'Fiverr' | 'Toptal' | 'Freelancer' | 'Other';
  budget?: string;
  duration?: string;
  description: string;
  url: string;
  postedAt?: string;
}

export enum ApplicationStatus {
  PENDING = 'PENDING',
  EXTRACTING = 'EXTRACTING',
  MATCHING = 'MATCHING',
  GENERATING_CL = 'GENERATING_CL',
  MUTATING_RESUME = 'MUTATING_RESUME',
  APPLYING = 'APPLYING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RISK_HALT = 'RISK_HALT',
  INTERPRETING = 'INTERPRETING',
  STRATEGIZING = 'STRATEGIZING',
  AUGMENTING = 'AUGMENTING',
  VERIFYING = 'VERIFYING'
}

export interface CommandResult {
  action: 'apply' | 'pause' | 'resume' | 'filter' | 'limit' | 'blocked' | 'status' | 'strategy' | 'find_gigs';
  goal?: string;
  filters?: {
    role?: string;
    location?: string;
    remote?: boolean;
    company_type?: string;
  };
}

// Added missing VerificationProof interface to fix errors in components/JobHunter.tsx
export interface VerificationProof {
  virtualScreenshot?: string;
  networkLogs?: string[];
  serverStatusCode?: number;
}

export interface ApplicationLog {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  status: ApplicationStatus;
  timestamp: string;
  url: string;
  platform?: string;
  location?: string;
  coverLetter?: string;
  mutatedResume?: ResumeJson;
  mutationReport?: any;
  verification?: VerificationProof;
}

export interface AppState {
  profile: UserProfile | null;
  applications: ApplicationLog[];
  activeStrategy: any | null;
}

export interface DiscoveredJob {
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
}

export interface MatchResult {
  score: number;
  reasoning: string;
  missingSkills: string[];
}

export enum CoverLetterStyle {
  ULTRA_CONCISE = 'Ultra Concise',
  RESULTS_DRIVEN = 'Results Driven',
  FOUNDER_FRIENDLY = 'Founder Friendly',
  TECHNICAL_DEEP_CUT = 'Technical Deep-Cut',
  CHILL_PROFESSIONAL = 'Chill but Professional'
}
