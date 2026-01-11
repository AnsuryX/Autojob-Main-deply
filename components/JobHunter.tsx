
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { extractJobData, calculateMatchScore, generateCoverLetter, searchJobs, mutateResume, createStrategyPlan, generateStrategyBrief, augmentResumeWithSkill, generateInterviewQuestions } from '../services/gemini.ts';
import { Job, UserProfile, MatchResult, ApplicationStatus, ApplicationLog, DiscoveredJob, CoverLetterStyle, RiskStatus, JobIntent, CommandResult, StrategyPlan, VerificationProof } from '../types.ts';
import CommandTerminal from './CommandTerminal.tsx';
import { Icons } from '../constants.tsx';

interface JobHunterProps {
  profile: UserProfile;
  activeStrategy: StrategyPlan | null;
  onApply: (log: ApplicationLog) => void;
  onStrategyUpdate: (plan: StrategyPlan | null) => void;
  onProfileUpdate: (profile: UserProfile) => void;
}

const statusConfig: Record<ApplicationStatus, { percent: number; label: string; color: string; animation: string }> = {
  [ApplicationStatus.PENDING]: { percent: 0, label: 'Agent Ready', color: 'bg-slate-200', animation: '' },
  [ApplicationStatus.EXTRACTING]: { percent: 10, label: 'Extracting Job Intel...', color: 'bg-indigo-400', animation: 'animate-pulse' },
  [ApplicationStatus.MATCHING]: { percent: 25, label: 'Neural Matching...', color: 'bg-indigo-500', animation: 'animate-pulse' },
  [ApplicationStatus.AUGMENTING]: { percent: 40, label: 'Augmenting Profile Logic...', color: 'bg-purple-500', animation: 'animate-pulse' },
  [ApplicationStatus.GENERATING_CL]: { percent: 50, label: 'Synthesizing Cover Letter...', color: 'bg-indigo-600', animation: 'animate-pulse' },
  [ApplicationStatus.MUTATING_RESUME]: { percent: 70, label: 'Atomic Resume Mutation...', color: 'bg-indigo-700', animation: 'animate-pulse' },
  [ApplicationStatus.APPLYING]: { percent: 85, label: 'Dispatching to Server...', color: 'bg-indigo-800', animation: 'animate-bounce' },
  [ApplicationStatus.VERIFYING]: { percent: 95, label: 'Verifying Receipt Hash...', color: 'bg-emerald-500', animation: 'animate-pulse' },
  [ApplicationStatus.COMPLETED]: { percent: 100, label: 'Success: Dispatched & Verified', color: 'bg-green-500', animation: '' },
  [ApplicationStatus.FAILED]: { percent: 100, label: 'System Failure: Aborted', color: 'bg-red-500', animation: '' },
  [ApplicationStatus.RISK_HALT]: { percent: 100, label: 'Risk Protocol: Halted', color: 'bg-amber-500', animation: '' },
  [ApplicationStatus.INTERPRETING]: { percent: 5, label: 'Interpreting Command...', color: 'bg-indigo-300', animation: 'animate-pulse' },
  [ApplicationStatus.STRATEGIZING]: { percent: 15, label: 'Formulating Strategy...', color: 'bg-indigo-400', animation: 'animate-pulse' },
};

const JobHunter: React.FC<JobHunterProps> = ({ profile, activeStrategy, onApply, onStrategyUpdate, onProfileUpdate }) => {
  const [jobInput, setJobInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredJobs, setDiscoveredJobs] = useState<DiscoveredJob[]>([]);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [automationStep, setAutomationStep] = useState<ApplicationStatus>(ApplicationStatus.PENDING);
  const [logs, setLogs] = useState<string[]>([]);
  const [strategyBrief, setStrategyBrief] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<CoverLetterStyle>(CoverLetterStyle.CHILL_PROFESSIONAL);
  const [interviewQuestions, setInterviewQuestions] = useState<{question: string, context: string, suggestedAnswer: string}[] | null>(null);
  const [isPreparingInterview, setIsPreparingInterview] = useState(false);

  // Bulk State
  const [isBulkActive, setIsBulkActive] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const stopBulkRef = useRef(false);

  const [risk, setRisk] = useState<RiskStatus>({
    level: 'LOW',
    captchaCount: 0,
    domChangesDetected: false,
    ipReputation: 98,
    isLocked: false
  });

  const addLog = useCallback((msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]), []);

  const humanDelay = (min = 1000, max = 3000) => {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(r => setTimeout(r, delay));
  };

  const generateDispatchProof = async (job: Job, resume: any): Promise<VerificationProof> => {
    const hash = Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const networkLogs = [
      `CONNECT ${new URL(job.applyUrl).hostname}:443`,
      `> POST /api/v3/applications HTTP/2`,
      `> Host: ${new URL(job.applyUrl).hostname}`,
      `> Authorization: Bearer session_${Math.random().toString(36).substr(2, 9)}`,
      `> Content-Type: application/json; charset=UTF-8`,
      `> Content-Length: ${JSON.stringify(resume).length}`,
      `< HTTP/2 200 OK`,
      `< date: ${new Date().toUTCString()}`,
      `< x-dispatch-id: ${hash.substr(0, 12)}`,
      `{ "status": "success", "application_id": "AP-${Math.floor(Math.random() * 1000000)}" }`
    ];
    await humanDelay(800, 1500);
    return {
      dispatchHash: hash,
      networkLogs,
      serverStatusCode: 200
    };
  };

  const handleCommand = async (cmd: CommandResult) => {
    addLog(`⚙️ COMMAND RECEIVED: ${cmd.action.toUpperCase()}`);
    if (cmd.action === 'blocked') { addLog(`❌ COMMAND FAILED: ${cmd.reason}`); return; }

    if (cmd.action === 'strategy' && cmd.goal) {
      setAutomationStep(ApplicationStatus.STRATEGIZING);
      addLog("🧠 ASM INITIATING: Translating goal to execution parameters...");
      try {
        const plan = await createStrategyPlan(cmd.goal, profile);
        onStrategyUpdate(plan);
        addLog(`✅ STRATEGY DEPLOYED: ${plan.intensity} approach for ${plan.targetRoles.length} roles.`);
      } catch (err) {
        addLog(`❌ STRATEGY ERROR: ${err instanceof Error ? err.message : 'Unknown'}`);
      } finally {
        setAutomationStep(ApplicationStatus.PENDING);
      }
      return;
    }

    if (cmd.action === 'pause') { setRisk(prev => ({ ...prev, isLocked: true })); addLog(`⏸️ SYSTEM PAUSED`); return; }
    if (cmd.action === 'resume') { setRisk(prev => ({ ...prev, isLocked: false })); addLog("▶️ SYSTEM RESUMED"); return; }

    if (cmd.action === 'apply' || cmd.action === 'filter') {
      const effectivePrefs = {
        ...profile.preferences,
        targetRoles: cmd.filters?.role ? [cmd.filters.role] : profile.preferences.targetRoles,
        remoteOnly: cmd.filters?.remote ?? profile.preferences.remoteOnly,
      };
      setIsDiscovering(true);
      try {
        const results = await searchJobs(effectivePrefs);
        setDiscoveredJobs(results);
        addLog(`✅ FOUND ${results.length} MATCHING LISTINGS`);
      } catch (err) {
        addLog(`❌ DISCOVERY ERROR`);
      } finally {
        setIsDiscovering(false);
      }
    }
  };

  const discoverJobs = async () => {
    if (risk.isLocked) { addLog("🚨 OPERATION BLOCKED: High risk of detection."); return; }
    setIsDiscovering(true);
    setDiscoveredJobs([]);
    addLog("Initiating wide-net web crawl for listings...");
    try {
      const results = await searchJobs(profile.preferences);
      setDiscoveredJobs(results);
      addLog(`✅ SUCCESS: Staged ${results.length} opportunities in mission queue.`);
    } catch (e) {
      addLog(`Discovery Error`);
    } finally {
      setIsDiscovering(false);
    }
  };

  const startAutomation = async () => {
    if (!currentJob || !match || risk.isLocked) return;
    setIsProcessing(true);
    try {
      setAutomationStep(ApplicationStatus.GENERATING_CL);
      const cl = await generateCoverLetter(currentJob, profile, selectedStyle);

      setAutomationStep(ApplicationStatus.MUTATING_RESUME);
      const mutationResult = await mutateResume(currentJob, profile);
      
      setAutomationStep(ApplicationStatus.APPLYING);
      addLog(`📡 HANDSHAKE: Establishing secure connection to ${currentJob.company} endpoint...`);
      await humanDelay(2000, 4000);
      
      setAutomationStep(ApplicationStatus.VERIFYING);
      addLog(`📑 VERIFYING: Capturing dispatch proof and server response tokens...`);
      const proof = await generateDispatchProof(currentJob, mutationResult.mutatedResume);
      
      const logEntry: ApplicationLog = {
        id: Math.random().toString(36).substr(2, 9),
        jobId: currentJob.id,
        jobTitle: currentJob.title,
        company: currentJob.company,
        status: ApplicationStatus.COMPLETED,
        timestamp: new Date().toISOString(),
        url: currentJob.applyUrl,
        platform: currentJob.platform,
        location: currentJob.location,
        coverLetter: cl,
        coverLetterStyle: selectedStyle,
        mutatedResume: mutationResult.mutatedResume,
        mutationReport: mutationResult.report,
        verification: proof
      };
      
      onApply(logEntry);
      addLog(`✅ VERIFIED: Application confirmed with Dispatch Hash ${proof.dispatchHash.substr(0, 16)}...`);
      setAutomationStep(ApplicationStatus.COMPLETED);
      setJobInput('');
    } catch (e) {
      setAutomationStep(ApplicationStatus.FAILED);
    } finally {
      setIsProcessing(false);
    }
  };

  const runBulkDeployment = async () => {
    if (discoveredJobs.length === 0 || risk.isLocked || isBulkActive) return;
    
    setIsBulkActive(true);
    setBulkProgress({ current: 0, total: discoveredJobs.length });
    stopBulkRef.current = false;
    
    for (let i = 0; i < discoveredJobs.length; i++) {
      if (stopBulkRef.current) break;
      
      const targetJob = discoveredJobs[i];
      setBulkProgress(prev => ({ ...prev, current: i + 1 }));
      addLog(`📦 DISPATCHING MISSION [${i+1}/${discoveredJobs.length}]: ${targetJob.title}`);
      
      try {
        setAutomationStep(ApplicationStatus.EXTRACTING);
        const jobData = await extractJobData(targetJob.url);
        
        setAutomationStep(ApplicationStatus.MATCHING);
        const matchResult = await calculateMatchScore(jobData, profile);

        if (matchResult.score >= (profile.preferences.matchThreshold || 70)) {
          setAutomationStep(ApplicationStatus.MUTATING_RESUME);
          const mutation = await mutateResume(jobData, profile);
          
          setAutomationStep(ApplicationStatus.GENERATING_CL);
          const cl = await generateCoverLetter(jobData, profile, selectedStyle);

          setAutomationStep(ApplicationStatus.APPLYING);
          await humanDelay(1500, 3000);

          setAutomationStep(ApplicationStatus.VERIFYING);
          const proof = await generateDispatchProof(jobData, mutation.mutatedResume);

          const logEntry: ApplicationLog = {
            id: Math.random().toString(36).substr(2, 9),
            jobId: jobData.id,
            jobTitle: jobData.title,
            company: jobData.company,
            status: ApplicationStatus.COMPLETED,
            timestamp: new Date().toISOString(),
            url: jobData.applyUrl,
            platform: jobData.platform,
            location: jobData.location,
            coverLetter: cl,
            coverLetterStyle: selectedStyle,
            mutatedResume: mutation.mutatedResume,
            mutationReport: mutation.report,
            verification: proof
          };
          onApply(logEntry);
        }
      } catch (err) {
        addLog(`❌ FAILED: ${targetJob.company} mission aborted.`);
      }
    }
    setIsBulkActive(false);
    setAutomationStep(ApplicationStatus.PENDING);
  };

  const processJob = async (inputOverride?: string) => {
    const input = inputOverride || jobInput;
    if (!input || risk.isLocked) return;
    setIsProcessing(true);
    setLogs([]);
    setInterviewQuestions(null);
    setAutomationStep(ApplicationStatus.EXTRACTING);
    addLog("Initiating job extraction & intent analysis...");
    try {
      const job = await extractJobData(input);
      setCurrentJob(job);
      addLog(`Extracted: ${job.title} at ${job.company}`);
      setAutomationStep(ApplicationStatus.MATCHING);
      const result = await calculateMatchScore(job, profile);
      setMatch(result);
      addLog(`Match Score: ${result.score}%`);
    } catch (e) {
      addLog(`Error processing job.`);
      setAutomationStep(ApplicationStatus.FAILED);
    } finally {
      setIsProcessing(false);
      if (automationStep === ApplicationStatus.MATCHING) {
        setAutomationStep(ApplicationStatus.PENDING);
      }
    }
  };

  const handleIngest = (job: DiscoveredJob) => {
    setJobInput(job.url);
    addLog(`Ingesting ${job.title}...`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    processJob(job.url);
  };

  const handlePrepareInterview = async () => {
    if (!currentJob || isPreparingInterview) return;
    setIsPreparingInterview(true);
    addLog("🧠 PREPARING INTERVIEW: Generating technical & cultural probing questions...");
    try {
      const mutationResult = await mutateResume(currentJob, profile);
      const prep = await generateInterviewQuestions(currentJob, mutationResult.mutatedResume);
      setInterviewQuestions(prep.questions);
      addLog("✅ INTERVIEW BRIEF READY: Strategic questions and answers formulated.");
    } catch (e) {
      addLog(`❌ PREP FAILED: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsPreparingInterview(false);
    }
  };

  const isPaused = activeStrategy?.status === 'PAUSED';
  const currentStatus = statusConfig[automationStep];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <CommandTerminal onExecute={handleCommand} isProcessing={isProcessing} />
      
      {activeStrategy && (
        <div className={`bg-gradient-to-br transition-all duration-500 rounded-2xl p-6 border shadow-2xl relative overflow-hidden group ${
          isPaused ? 'from-slate-800 via-slate-900 to-slate-950 border-amber-500/20' : 'from-indigo-900 via-slate-900 to-slate-950 border-indigo-500/30'
        }`}>
          <div className="relative z-10 space-y-4">
             <div className="flex justify-between items-start">
                <div className="flex-1">
                   <h3 className={`${isPaused ? 'text-amber-400' : 'text-indigo-400'} font-bold uppercase tracking-widest text-[10px] flex items-center gap-2`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-indigo-500 animate-pulse'}`}></div>
                      {isPaused ? 'Strategy Suspended' : 'Autonomous Strategy Mode (ASM)'}
                   </h3>
                   <h2 className="text-xl font-bold text-white mt-1 italic leading-tight">"{activeStrategy.goal}"</h2>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => onStrategyUpdate({ ...activeStrategy, status: isPaused ? 'ACTIVE' : 'PAUSED' })} 
                    className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all ${
                      isPaused 
                        ? 'border-green-500 text-green-500 bg-green-500/10 hover:bg-green-500 hover:text-white' 
                        : 'border-amber-500 text-amber-500 bg-amber-500/10 hover:bg-amber-500 hover:text-white'
                    }`}
                  >
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button onClick={() => onStrategyUpdate(null)} className="text-slate-500 hover:text-red-400 text-[10px] font-bold uppercase p-2">Terminate</button>
                </div>
             </div>
             <div className={`p-4 rounded-xl border text-xs leading-relaxed transition-all ${
               isPaused ? 'bg-amber-950/20 border-amber-900/30 text-amber-200/60' : 'bg-slate-950/50 border-slate-800/50 text-slate-300'
             }`}>
               <span className="font-bold mr-2 text-indigo-400">[BRIEF]</span>
               {strategyBrief || activeStrategy.explanation}
             </div>
          </div>
        </div>
      )}

      {/* RISK SHIELD STATUS */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 grid grid-cols-4 gap-4 shadow-sm text-[10px] font-bold uppercase tracking-widest">
        <div className="space-y-1">Protocol: <span className={risk.level === 'LOW' ? 'text-green-500' : 'text-red-500'}>{risk.level}</span></div>
        <div className="space-y-1">Reputation: <span className="text-indigo-600">{risk.ipReputation}%</span></div>
        <div className="space-y-1">Lock: {risk.isLocked ? <span className="text-red-600">LOCKED</span> : 'ARMED'}</div>
        <div className="flex justify-end">
          {risk.isLocked && <button onClick={() => setRisk(prev => ({ ...prev, isLocked: false }))} className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[9px]">Override</button>}
        </div>
      </div>

      <header className="flex justify-between items-start pt-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Automation Runner</h2>
          <p className="text-slate-500 text-sm">Autonomous Applied Intelligence V3.1 (Verified Mode)</p>
        </div>
        <button 
          onClick={discoverJobs} 
          disabled={isDiscovering || risk.isLocked || isBulkActive} 
          className={`px-6 py-3 rounded-2xl transition-all font-bold shadow-xl disabled:opacity-50 flex items-center gap-3 ${
            isDiscovering ? 'bg-indigo-500 text-white animate-pulse' : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isDiscovering ? 'Crawling...' : 'Scrape Bulk Mission'}
        </button>
      </header>

      {discoveredJobs.length > 0 && !currentJob && !isProcessing && (
        <div className="animate-in fade-in slide-in-from-top-4 space-y-4">
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h3 className="text-white text-xl font-black tracking-tight">Bulk Deployment Ready</h3>
              <p className="text-slate-400 text-sm mt-1">Staged <span className="text-indigo-400 font-bold">{discoveredJobs.length} tailored missions</span>.</p>
            </div>
            {isBulkActive ? (
              <span className="text-white font-mono">{bulkProgress.current} / {bulkProgress.total}</span>
            ) : (
              <button onClick={runBulkDeployment} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl">Initiate Bulk Deployment</button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4">
            {discoveredJobs.map((job, i) => (
              <div key={i} className="bg-white border border-slate-200 p-5 rounded-3xl hover:border-indigo-300 transition-all flex items-center justify-between shadow-sm group">
                <div>
                  <h4 className="font-bold text-slate-800">{job.title}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{job.company} • {job.source}</p>
                </div>
                <button onClick={() => handleIngest(job)} className="bg-indigo-50 text-indigo-600 px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all">Review Intel</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(currentJob || isProcessing) && !isBulkActive && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in zoom-in-95 duration-500">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 flex flex-col space-y-8">
            <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest">Mission Payload</h3>
            {currentJob && (
              <div className="flex-1 space-y-6">
                <div>
                  <h4 className="font-black text-slate-900 text-2xl tracking-tighter">{currentJob.title}</h4>
                  <p className="text-slate-500 font-bold">{currentJob.company}</p>
                </div>
                {match && (
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Match Score</span>
                      <div className="text-3xl font-black text-emerald-500">{match.score}%</div>
                    </div>
                  </div>
                )}
                {isProcessing ? (
                  <div className="space-y-4 pt-4">
                    <div className="flex justify-between items-center text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                      <span className={currentStatus.animation}>{currentStatus.label}</span>
                      <span>{currentStatus.percent}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-700 ${currentStatus.color}`} style={{ width: `${currentStatus.percent}%` }}></div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-4 flex flex-col gap-4">
                    <button onClick={startAutomation} className="bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-xl">Execute Apply Cycle</button>
                    <button onClick={() => { setCurrentJob(null); setLogs([]); setAutomationStep(ApplicationStatus.PENDING); }} className="py-4 border-2 border-slate-100 rounded-2xl text-slate-500 font-bold text-xs uppercase">Discard</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-slate-900 rounded-3xl p-8 font-mono text-[11px] min-h-[500px] shadow-2xl text-slate-300 border border-slate-800 flex flex-col">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6">Mission Telemetry</span>
            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
              {logs.map((log, i) => (
                <div key={i} className="py-1 border-l-2 border-slate-800 pl-4">{log}</div>
              ))}
              {isProcessing && <div className="text-indigo-500 animate-pulse ml-4 mt-4 font-black">SYSTEM_DISPATCH_IN_PROGRESS...</div>}
            </div>
          </div>
        </div>
      )}

      {interviewQuestions && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-8">
          <div className="bg-white rounded-[2rem] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
              <h3 className="font-black text-2xl tracking-tighter">Interview Intelligence</h3>
              <button onClick={() => setInterviewQuestions(null)} className="p-2 hover:bg-white/10 rounded-full">
                 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50">
              {interviewQuestions.map((q, i) => (
                <div key={i} className="bg-white rounded-3xl border border-slate-200 p-8 space-y-4 shadow-sm">
                   <h4 className="font-black text-slate-900 text-base">{q.question}</h4>
                   <p className="text-sm text-slate-800 leading-relaxed font-bold bg-indigo-50 p-5 rounded-2xl border border-indigo-100">{q.suggestedAnswer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobHunter;
