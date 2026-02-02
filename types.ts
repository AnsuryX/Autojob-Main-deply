
export interface OutreachDraft {
  platform: 'LinkedIn' | 'Email';
  recipientRole: string;
  message: string;
}

export interface InterviewScorecard {
  overallScore: number;
  technicalAccuracy: number;
  communicationTone: string;
  keyStrengths: string[];
  improvementAreas: string[];
}

export interface ResumeJson {
  summary: string;
  skills: string[];
  experience: Experience[];
  projects: Project[];
  education?: Education[];
  languages?: string[];
  certifications?: Certification[];
}

export interface Education {
  institution: string;
  degree: string;
  duration: string;
}

export interface Certification {
  name: string;
  issuer: string;
  date: string;
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

export interface MarketInsights {
  salaryRange: string;
  demandTrend: 'High' | 'Stable' | 'Decreasing';
  topSkills: string[];
  recentNews: { title: string; url: string }[];
  citations: { web: { uri: string; title: string } }[];
}

export interface RoadmapStep {
  period: string;
  goal: string;
  actionItems: string[];
  skillGain: string[];
}

export interface CareerRoadmap {
  currentMarketValue: string;
  targetMarketValue: string;
  gapAnalysis: string;
  steps: RoadmapStep[];
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
  salary?: string;
  thumbnail?: string;
  outreach?: OutreachDraft[];
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
  thumbnail?: string;
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
  VERIFYING = 'VERIFYING',
  INTERVIEWING = 'INTERVIEWING'
}

export interface CommandResult {
  action: 'apply' | 'search_jobs' | 'update_profile' | 'improve_resume' | 'status' | 'strategy' | 'find_gigs' | 'blocked' | 'switch_tab' | 'start_interview';
  goal?: string;
  params?: {
    profile_updates?: Partial<UserProfile>;
    preferences_updates?: Partial<UserProfile['preferences']>;
    improvement_prompt?: string;
    target_tab?: string;
    query?: string;
  };
}

export interface DiscoveredJob {
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  salary?: string;
  thumbnail?: string;
  description?: string;
  postedAt?: string;
  matchScore?: number;
}

export interface MatchResult {
  score: number;
  reasoning: string;
  missingSkills: string[];
}

export type ResumeTemplate = 'Modern' | 'Classic' | 'Tech' | 'Executive';

export enum CoverLetterStyle {
  MODERN = 'Modern',
  CLASSIC = 'Classic',
  TECH = 'Tech',
  EXECUTIVE = 'Executive',
  CHILL_PROFESSIONAL = 'Chill Professional'
}

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
  mutatedResume?: any;
  mutationReport?: {
    atsScoreEstimate?: number;
    keywordsInjected?: string[];
  };
  verification?: VerificationProof;
}

export interface TaskState {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export interface AppState {
  profile: UserProfile | null;
  applications: ApplicationLog[];
  activeStrategy: any;
  discoveredJobs: DiscoveredJob[];
  roadmap: CareerRoadmap | null;
  tasks: Record<string, TaskState>;
}
