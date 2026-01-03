
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
    selectedTrackId: string;
    selectedTrackName: string;
    keywordsInjected: string[];
    mirroredPhrases: { original: string; mirrored: string }[];
    reorderingJustification: string;
    atsScoreEstimate: number;
    iterationCount: number;
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

export enum JobIntent {
  REAL_HIRE = 'Real Hire',
  GHOST_JOB = 'Ghost Job',
  DATA_HARVEST = 'Data Harvesting',
  TRAINING_SCAM = 'Training/Upskilling Scam',
  EVERGREEN = 'Evergreen/Pipeline'
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  skills: string[];
  description: string;
  applyUrl: string;
  scrapedAt: string;
  platform: 'LinkedIn' | 'Indeed' | 'Wellfound' | 'Other';
  intent?: {
    type: JobIntent;
    confidence: number;
    reasoning: string;
  };
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

export interface RiskStatus {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  captchaCount: number;
  domChangesDetected: boolean;
  ipReputation: number; // 0-100
  isLocked: boolean;
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
  AUGMENTING = 'AUGMENTING'
}

export interface CommandResult {
  action: 'apply' | 'pause' | 'resume' | 'filter' | 'limit' | 'blocked' | 'status' | 'strategy';
  goal?: string;
  filters?: {
    role?: string;
    location?: string;
    remote?: boolean;
    company_type?: string;
    posted_within?: string;
    exclude_roles?: string[];
  };
  limits?: {
    max_applications?: number;
    daily_quota?: number;
  };
  schedule?: {
    duration?: string;
  };
  reason?: string;
}

export interface StrategyPlan {
  goal: string;
  dailyQuota: number;
  targetRoles: string[];
  platforms: string[];
  intensity: 'Aggressive' | 'Balanced' | 'Precision';
  explanation: string;
  lastUpdate: string;
  status: 'ACTIVE' | 'PAUSED' | 'OPTIMIZING';
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
  coverLetterStyle?: CoverLetterStyle;
  mutatedResume?: ResumeJson;
  mutationReport?: ResumeMutation['report'];
  error?: string;
}

export interface AppState {
  profile: UserProfile | null;
  applications: ApplicationLog[];
  activeStrategy: StrategyPlan | null;
}
