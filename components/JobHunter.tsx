
import React, { useState, useCallback } from 'react';
import { extractJobData, calculateMatchScore, generateCoverLetter, searchJobs, mutateResume } from '../services/gemini.ts';
import { Job, UserProfile, MatchResult, ApplicationStatus, ApplicationLog, DiscoveredJob, CoverLetterStyle, VerificationProof } from '../types.ts';
import CommandTerminal from './CommandTerminal.tsx';
import { Icons } from '../constants.tsx';

interface JobHunterProps {
  profile: UserProfile;
  activeStrategy: any;
  onApply: (log: ApplicationLog) => void;
  onStrategyUpdate: (plan: any) => void;
  onProfileUpdate: (profile: UserProfile) => void;
}

const statusConfig: Record<ApplicationStatus, { label: string; color: string }> = {
  [ApplicationStatus.PENDING]: { label: 'Ready to Start', color: 'bg-slate-200' },
  [ApplicationStatus.EXTRACTING]: { label: 'Reading Job Details...', color: 'bg-indigo-400' },
  [ApplicationStatus.MATCHING]: { label: 'Checking Your Skills...', color: 'bg-indigo-500' },
  [ApplicationStatus.GENERATING_CL]: { label: 'Writing Cover Letter...', color: 'bg-indigo-600' },
  [ApplicationStatus.MUTATING_RESUME]: { label: 'Tailoring Your Resume...', color: 'bg-indigo-700' },
  [ApplicationStatus.APPLYING]: { label: 'Preparing Dispatch Kit...', color: 'bg-indigo-800' },
  [ApplicationStatus.VERIFYING]: { label: 'Finalizing Record...', color: 'bg-emerald-500' },
  [ApplicationStatus.COMPLETED]: { label: 'Package Ready!', color: 'bg-green-500' },
  [ApplicationStatus.FAILED]: { label: 'Error occurred', color: 'bg-red-500' },
  [ApplicationStatus.AUGMENTING]: { label: 'Enhancing Profile...', color: 'bg-purple-500' },
  [ApplicationStatus.INTERPRETING]: { label: 'Understanding Request...', color: 'bg-indigo-300' },
  [ApplicationStatus.STRATEGIZING]: { label: 'Planning Strategy...', color: 'bg-indigo-400' },
  [ApplicationStatus.RISK_HALT]: { label: 'Security Warning', color: 'bg-amber-500' },
};

const JobHunter: React.FC<JobHunterProps> = ({ profile, onApply }) => {
  const [jobInput, setJobInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [discoveredJobs, setDiscoveredJobs] = useState<DiscoveredJob[]>([]);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [automationStep, setAutomationStep] = useState<ApplicationStatus>(ApplicationStatus.PENDING);
  const [logs, setLogs] = useState<string[]>([]);
  const [generatedArtifacts, setGeneratedArtifacts] = useState<{ cl: string, resume: any } | null>(null);

  const addLog = useCallback((msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]), []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addLog(`Copied ${label} to clipboard!`);
  };

  const processInput = async () => {
    if (!jobInput.trim()) return;
    const isUrl = jobInput.toLowerCase().startsWith('http');
    setIsProcessing(true);
    setLogs([]);
    setMatch(null);
    setGeneratedArtifacts(null);
    setAutomationStep(isUrl ? ApplicationStatus.EXTRACTING : ApplicationStatus.STRATEGIZING);
    
    try {
      if (isUrl) {
        addLog(`Analyzing link: ${jobInput}`);
        const job = await extractJobData(jobInput);
        setCurrentJob(job);
        addLog(`Found: ${job.title} @ ${job.company}`);
        
        setAutomationStep(ApplicationStatus.MATCHING);
        const res = await calculateMatchScore(job, profile);
        setMatch(res);
      } else {
        addLog(`Searching live listings for: "${jobInput}"...`);
        const results = await searchJobs({ ...profile.preferences, targetRoles: [jobInput] });
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
      const proof: VerificationProof = {
        dispatchHash: `DISP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        networkLogs: ["Tailoring Complete", "Artifacts stored in cloud", "Ready for manual submission"],
        serverStatusCode: 200
      };

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
        mutationReport: mutation.report,
        verification: proof
      });

      setAutomationStep(ApplicationStatus.COMPLETED);
      addLog(`Package generated! Use the buttons below to apply.`);
    } catch (e: any) {
      addLog(`Tailoring Failed: ${e.message}`);
      setAutomationStep(ApplicationStatus.FAILED);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <CommandTerminal onExecute={(cmd) => addLog(`Command: ${cmd.action}`)} isProcessing={isProcessing} />

      <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Icons.Briefcase /> Lead Finder & Tailor
        </h2>
        <div className="relative">
          <input
            type="text"
            value={jobInput}
            onChange={(e) => setJobInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && processInput()}
            placeholder="Paste Job URL or search for 'Software Engineer'..."
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 transition-all"
          />
          <button
            onClick={processInput}
            disabled={isProcessing || !jobInput}
            className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50"
          >
            {isProcessing ? 'Working...' : 'Go'}
          </button>
        </div>
      </div>

      {discoveredJobs.length > 0 && !currentJob && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase text-slate-400 px-4">Live Listings Found</p>
          {discoveredJobs.map((job, i) => (
            <div key={i} className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer hover:border-indigo-400" onClick={() => { setJobInput(job.url); processInput(); }}>
              <div>
                <h4 className="font-bold text-slate-800">{job.title}</h4>
                <p className="text-xs text-slate-400 font-bold">{job.company} • {job.location}</p>
              </div>
              <button className="text-[10px] font-black text-indigo-600 uppercase">Tailor Now</button>
            </div>
          ))}
        </div>
      )}

      {currentJob && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in zoom-in-95">
          <div className="bg-white rounded-[2rem] border border-slate-200 p-8 space-y-6 shadow-sm">
            <div>
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Active Lead</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{currentJob.title}</h3>
              <p className="text-slate-500 font-bold">{currentJob.company} • {currentJob.location}</p>
            </div>

            {match && (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-black text-slate-900">{match.score}%</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase pb-1.5 tracking-widest">Match Strength</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed italic">"{match.reasoning}"</p>
              </div>
            )}

            {generatedArtifacts ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex flex-col gap-3">
                  <p className="text-xs font-bold text-green-700">✓ Your Tailored Dispatch Kit is Ready!</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => copyToClipboard(generatedArtifacts.cl, 'Cover Letter')}
                      className="bg-white border border-green-200 p-3 rounded-xl text-[10px] font-black uppercase text-green-700 hover:bg-green-100 transition-all"
                    >
                      Copy Cover Letter
                    </button>
                    <button 
                      onClick={() => copyToClipboard(generatedArtifacts.resume.summary, 'Resume Summary')}
                      className="bg-white border border-green-200 p-3 rounded-xl text-[10px] font-black uppercase text-green-700 hover:bg-green-100 transition-all"
                    >
                      Copy Tailored Summary
                    </button>
                  </div>
                  <a 
                    href={currentJob.applyUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-full bg-slate-900 text-white p-4 rounded-xl text-[10px] font-black uppercase text-center tracking-widest hover:bg-black"
                  >
                    Open Application Portal
                  </a>
                </div>
                <button onClick={() => setCurrentJob(null)} className="w-full text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Another Job</button>
              </div>
            ) : (
              <div className="space-y-4">
                {isProcessing ? (
                  <div className="text-center py-4">
                    <p className="text-[10px] font-black text-indigo-600 uppercase animate-pulse">{statusConfig[automationStep].label}</p>
                    <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 animate-[loading_2s_ease-in-out_infinite]"></div>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={startTailoring} 
                    className="w-full bg-indigo-600 text-white p-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all"
                  >
                    Generate Tailored Package
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="bg-slate-950 rounded-[2rem] p-8 font-mono text-[10px] text-slate-500 shadow-2xl flex flex-col max-h-[400px]">
            <p className="text-indigo-400 font-black uppercase tracking-widest mb-4">Agent Telemetry</p>
            <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-hide">
              {logs.map((log, i) => <div key={i} className="pl-3 border-l border-white/10">{log}</div>)}
              {logs.length === 0 && <div className="opacity-30">Awaiting instructions...</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobHunter;
