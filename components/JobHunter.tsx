
import React, { useState, useCallback, useMemo } from 'react';
import { extractJobData, calculateMatchScore, generateCoverLetter, searchJobsPro, mutateResume, getMarketInsights, generateOutreach } from '../services/gemini.ts';
import { Job, UserProfile, ApplicationStatus, ApplicationLog, DiscoveredJob, CoverLetterStyle, VerificationProof, MarketInsights, TaskState, OutreachDraft } from '../types.ts';
import { Icons } from '../constants.tsx';

interface JobHunterProps {
  profile: UserProfile;
  activeStrategy: any;
  discoveredJobs: DiscoveredJob[];
  onDiscoveredJobsUpdate: (jobs: DiscoveredJob[]) => void;
  onApply: (log: ApplicationLog) => void;
  onStrategyUpdate: (plan: any) => void;
  onProfileUpdate: (profile: UserProfile) => void;
  onTabSwitch?: (tab: string) => void;
  task: TaskState;
}

const JobHunter: React.FC<JobHunterProps> = ({ profile, discoveredJobs, onDiscoveredJobsUpdate, onApply, onTabSwitch, task }) => {
  const [jobInput, setJobInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [match, setMatch] = useState<any>(null);
  const [marketInsights, setMarketInsights] = useState<MarketInsights | null>(null);
  const [outreach, setOutreach] = useState<OutreachDraft[]>([]);
  const [automationStep, setAutomationStep] = useState<ApplicationStatus>(ApplicationStatus.PENDING);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]), []);

  const isSearching = task.status === 'running';
  const isSearchComplete = task.status === 'completed';

  const processInput = async (inputOverride?: string) => {
    const target = inputOverride || jobInput;
    if (!target.trim() || isSearching) return;
    
    setIsProcessing(true);
    setOutreach([]);
    setMatch(null);
    
    try {
      if (target.toLowerCase().startsWith('http')) {
        setAutomationStep(ApplicationStatus.EXTRACTING);
        const job = await extractJobData(target);
        setCurrentJob(job);
        
        setAutomationStep(ApplicationStatus.MATCHING);
        const [res, insights, outreachDrafts] = await Promise.all([
          calculateMatchScore(job, profile),
          getMarketInsights(job.title),
          generateOutreach(job, profile)
        ]);
        
        setMatch(res);
        setMarketInsights(insights);
        setOutreach(outreachDrafts);
      } else {
        const results = await searchJobsPro(target);
        onDiscoveredJobsUpdate(results || []);
      }
    } catch (e: any) {
      addLog(`Neural Scan Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
      setAutomationStep(ApplicationStatus.PENDING);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Outreach message copied to clipboard.");
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Search Header */}
      <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Icons.Briefcase /> Lead Discovery Hub
          </h2>
          {isSearching && <span className="text-[10px] font-black text-indigo-600 animate-pulse uppercase tracking-widest">Agent Scanning Web...</span>}
        </div>
        <div className="relative">
          <input
            type="text"
            value={jobInput}
            onChange={(e) => setJobInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && processInput()}
            placeholder="Search role or paste URL..."
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 transition-all pr-40"
          />
          <button
            onClick={() => processInput()}
            disabled={isProcessing || isSearching}
            className="absolute right-2 top-2 bottom-2 bg-slate-900 hover:bg-black text-white px-6 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all"
          >
            {isProcessing ? 'Thinking...' : 'Neural Search'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Results Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          {discoveredJobs?.map((job, i) => (
            <div 
              key={i} 
              className={`bg-white border p-5 rounded-2xl cursor-pointer hover:border-indigo-400 transition-all shadow-sm ${jobInput === job.url ? 'ring-2 ring-indigo-500' : 'border-slate-100'}`}
              onClick={() => { setJobInput(job.url); processInput(job.url); }}
            >
              <h4 className="font-bold text-slate-800 text-xs truncate">{job.title}</h4>
              <p className="text-[10px] text-slate-500 font-bold">{job.company} • {job.location}</p>
            </div>
          ))}
        </div>

        {/* Detailed Analysis Area */}
        <div className="lg:col-span-8 space-y-6">
          {currentJob && (
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm space-y-8 animate-in slide-in-from-right-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Active Target Analysis</span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">{currentJob.title}</h3>
                  <p className="text-slate-500 font-bold">{currentJob.company}</p>
                </div>
                {match && (
                  <div className="text-right">
                    <div className="text-4xl font-black text-slate-900">{match.score}%</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Neural Match Score</div>
                  </div>
                )}
              </div>

              {/* Match Details & Missing Skills */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Gap Analysis</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium italic mb-4">"{match?.reasoning || 'Calculating match factors...'}"</p>
                  <div className="flex flex-wrap gap-1.5">
                    {match?.missingSkills?.map((s: string, i: number) => (
                      <span key={i} className="text-[8px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 uppercase">{s}</span>
                    ))}
                  </div>
                </div>

                {/* Outreach Engine Integration */}
                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Neural Outreach (Hiring Mgr)</h4>
                  <div className="space-y-3">
                    {outreach.map((o, i) => (
                      <div key={i} className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black text-indigo-400 uppercase">{o.platform} Draft</span>
                          <button onClick={() => copyToClipboard(o.message)} className="text-[9px] font-black text-indigo-600 hover:underline">Copy</button>
                        </div>
                        <p className="text-[10px] text-slate-600 line-clamp-2 italic leading-tight">"{o.message}"</p>
                      </div>
                    ))}
                    {outreach.length === 0 && !isProcessing && (
                      <p className="text-[9px] text-slate-400 text-center py-4">Awaiting outreach synthesis...</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  className="flex-1 bg-slate-900 text-white p-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-lg transition-all"
                >
                  Synthesize Dispatch Artifacts
                </button>
                <button 
                  onClick={() => onTabSwitch?.('interview')}
                  className="flex-1 border border-slate-200 text-slate-600 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  Practice Interview Chamber
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobHunter;
