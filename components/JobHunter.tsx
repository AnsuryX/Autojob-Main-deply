
import React, { useState, useCallback } from 'react';
import { extractJobData, calculateMatchScore, generateCoverLetter, searchJobs, mutateResume } from '../services/gemini.ts';
import { Job, UserProfile, MatchResult, ApplicationStatus, ApplicationLog, DiscoveredJob, CoverLetterStyle, VerificationProof, CommandResult } from '../types.ts';
import CommandTerminal from './CommandTerminal.tsx';
import { Icons } from '../constants.tsx';

interface JobHunterProps {
  profile: UserProfile;
  activeStrategy: any;
  onApply: (log: ApplicationLog) => void;
  onStrategyUpdate: (plan: any) => void;
  onProfileUpdate: (profile: UserProfile) => void;
  onTabSwitch?: (tab: string) => void;
}

const statusConfig: Record<ApplicationStatus, { label: string; color: string }> = {
  [ApplicationStatus.PENDING]: { label: 'Idle', color: 'bg-slate-200' },
  [ApplicationStatus.EXTRACTING]: { label: 'Analyzing Job Posting...', color: 'bg-indigo-400' },
  [ApplicationStatus.MATCHING]: { label: 'Matching Your Skills...', color: 'bg-indigo-500' },
  [ApplicationStatus.GENERATING_CL]: { label: 'Writing Custom Letter...', color: 'bg-indigo-600' },
  [ApplicationStatus.MUTATING_RESUME]: { label: 'Tailoring Resume Summary...', color: 'bg-indigo-700' },
  [ApplicationStatus.APPLYING]: { label: 'Finalizing Dispatch Kit...', color: 'bg-indigo-800' },
  [ApplicationStatus.VERIFYING]: { label: 'Saving to Cloud...', color: 'bg-emerald-500' },
  [ApplicationStatus.COMPLETED]: { label: 'Ready for Submission!', color: 'bg-green-500' },
  [ApplicationStatus.FAILED]: { label: 'Mission Failed', color: 'bg-red-500' },
  [ApplicationStatus.AUGMENTING]: { label: 'Enhancing Profile...', color: 'bg-purple-500' },
  [ApplicationStatus.INTERPRETING]: { label: 'Decoding Command...', color: 'bg-indigo-300' },
  [ApplicationStatus.STRATEGIZING]: { label: 'Optimizing Search...', color: 'bg-indigo-400' },
  [ApplicationStatus.RISK_HALT]: { label: 'Blocked by Bot-Check', color: 'bg-amber-500' },
};

const JobHunter: React.FC<JobHunterProps> = ({ profile, onApply, onTabSwitch }) => {
  const [jobInput, setJobInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [discoveredJobs, setDiscoveredJobs] = useState<DiscoveredJob[]>([]);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [automationStep, setAutomationStep] = useState<ApplicationStatus>(ApplicationStatus.PENDING);
  const [logs, setLogs] = useState<string[]>([]);
  const [generatedArtifacts, setGeneratedArtifacts] = useState<{ cl: string, resume: any } | null>(null);

  const addLog = useCallback((msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]), []);

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    addLog(`Success: ${label} copied to clipboard.`);
  };

  const processInput = async (inputOverride?: string) => {
    const target = inputOverride || jobInput;
    if (!target.trim()) return;
    
    const isUrl = target.toLowerCase().startsWith('http');
    setIsProcessing(true);
    setLogs([]);
    setMatch(null);
    setGeneratedArtifacts(null);
    setAutomationStep(isUrl ? ApplicationStatus.EXTRACTING : ApplicationStatus.STRATEGIZING);
    
    try {
      if (isUrl) {
        addLog(`Analyzing link: ${target}`);
        const job = await extractJobData(target);
        setCurrentJob(job);
        addLog(`Identified: ${job.title} at ${job.company}`);
        setAutomationStep(ApplicationStatus.MATCHING);
        const res = await calculateMatchScore(job, profile);
        setMatch(res);
      } else {
        addLog(`Searching web for: "${target}"...`);
        const results = await searchJobs({ ...profile.preferences, targetRoles: [target] });
        setDiscoveredJobs(results || []);
        addLog(`Found ${results?.length || 0} active leads.`);
      }
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
      setAutomationStep(ApplicationStatus.FAILED);
    } finally {
      setIsProcessing(false);
      if (automationStep !== ApplicationStatus.FAILED) setAutomationStep(ApplicationStatus.PENDING);
    }
  };

  const handleCommand = (cmd: CommandResult) => {
    if (cmd.action === 'find_gigs' && onTabSwitch) {
      addLog(`Switching to Freelance Engine for: ${cmd.goal || 'projects'}`);
      onTabSwitch('freelance');
      // Tab handling logic is in App.tsx
      return;
    }
    addLog(`Command Received: ${cmd.action} ${cmd.goal || ''}`);
    if (cmd.goal) {
      setJobInput(cmd.goal);
      processInput(cmd.goal);
    }
  };

  const startTailoring = async () => {
    if (!currentJob || isProcessing) return;
    setIsProcessing(true);
    try {
      setAutomationStep(ApplicationStatus.GENERATING_CL);
      const cl = await generateCoverLetter(currentJob, profile, CoverLetterStyle.CHILL_PROFESSIONAL);
      setAutomationStep(ApplicationStatus.MUTATING_RESUME);
      const mutation = await mutateResume(currentJob, profile);
      setGeneratedArtifacts({ cl, resume: mutation.mutatedResume });
      setAutomationStep(ApplicationStatus.VERIFYING);
      
      onApply({
        id: Math.random().toString(36).substr(2, 9),
        jobId: currentJob.id,
        jobTitle: currentJob.title,
        company: currentJob.company,
        status: ApplicationStatus.COMPLETED,
        timestamp: new Date().toISOString(),
        url: currentJob.applyUrl,
        location: currentJob.location || "Remote",
        platform: currentJob.platform || "Other",
        coverLetter: cl,
        mutatedResume: mutation.mutatedResume,
        mutationReport: mutation.report
      });

      setAutomationStep(ApplicationStatus.COMPLETED);
      addLog(`Package ready! Use the 'Copy' buttons to apply.`);
    } catch (e: any) {
      addLog(`Tailoring Failed: ${e.message}`);
      setAutomationStep(ApplicationStatus.FAILED);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <CommandTerminal onExecute={handleCommand} isProcessing={isProcessing} />

      <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Icons.Briefcase /> Lead Finder & Assistant
        </h2>
        <div className="relative">
          <input
            type="text"
            value={jobInput}
            onChange={(e) => setJobInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && processInput()}
            placeholder="Paste a Job Link or type e.g. 'Frontend Lead'..."
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 transition-all pr-40"
          />
          <button
            onClick={() => processInput()}
            disabled={isProcessing || !jobInput}
            className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all"
          >
            {isProcessing ? 'Searching...' : 'Find Jobs'}
          </button>
        </div>
      </div>

      {discoveredJobs.length > 0 && !currentJob && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase text-slate-400 px-4 tracking-[0.2em]">Discovery Results</p>
          {discoveredJobs.map((job, i) => (
            <div key={i} className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer hover:border-indigo-400 group transition-all" onClick={() => { setJobInput(job.url); processInput(job.url); }}>
              <div>
                <h4 className="font-bold text-slate-800">{job.title}</h4>
                <p className="text-xs text-slate-400 font-bold">{job.company} • <span className="text-indigo-500">{job.location}</span></p>
              </div>
              <button className="bg-slate-50 text-[10px] font-black text-indigo-600 uppercase px-3 py-2 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all">Tailor Now</button>
            </div>
          ))}
        </div>
      )}

      {currentJob && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in zoom-in-95">
          <div className="bg-white rounded-[2rem] border border-slate-200 p-8 space-y-6 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Active Target</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1 leading-tight">{currentJob.title}</h3>
                <p className="text-slate-500 font-bold">{currentJob.company} • {currentJob.location}</p>
              </div>
              <button onClick={() => { setCurrentJob(null); setGeneratedArtifacts(null); }} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Icons.Close /></button>
            </div>

            {match && !generatedArtifacts && (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-black text-slate-900">{match.score}%</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase pb-1.5 tracking-widest">Match Rating</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">"{match.reasoning}"</p>
              </div>
            )}

            {generatedArtifacts ? (
              <div className="space-y-4">
                <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white"><Icons.Check /></div>
                    <p className="text-xs font-black text-emerald-800 uppercase tracking-tight">Dispatch Kit Ready</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={() => copyToClipboard(generatedArtifacts.cl, 'Letter')}
                      className="flex items-center justify-between bg-white border border-emerald-200 px-4 py-3 rounded-xl text-[10px] font-black uppercase text-emerald-700 hover:bg-emerald-100 transition-all"
                    >
                      Copy Letter
                    </button>
                    <button 
                      onClick={() => copyToClipboard(generatedArtifacts.resume.summary, 'Summary')}
                      className="flex items-center justify-between bg-white border border-emerald-200 px-4 py-3 rounded-xl text-[10px] font-black uppercase text-emerald-700 hover:bg-emerald-100 transition-all"
                    >
                      Copy Summary
                    </button>
                  </div>
                  <a 
                    href={currentJob.applyUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-full bg-slate-900 text-white p-4 rounded-xl text-[10px] font-black uppercase text-center tracking-widest hover:bg-black"
                  >
                    Open Portal
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {isProcessing ? (
                  <div className="text-center py-4 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-black text-indigo-600 uppercase animate-pulse">{statusConfig[automationStep].label}</p>
                    <div className="mt-3 h-1.5 mx-8 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 animate-[loading_2s_ease-in-out_infinite]"></div>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={startTailoring} 
                    className="w-full bg-indigo-600 text-white p-5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    Create Custom Package
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="bg-slate-950 rounded-[2rem] p-8 font-mono text-[10px] text-slate-500 shadow-2xl flex flex-col max-h-[400px]">
            <p className="text-indigo-400 font-black uppercase tracking-[0.2em] mb-4">Operations Log</p>
            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
              {logs.map((log, i) => (
                <div key={i} className="pl-3 border-l border-white/5 py-0.5">
                  {log}
                </div>
              ))}
              {logs.length === 0 && <div className="opacity-20 italic">Awaiting input...</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobHunter;
