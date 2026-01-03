
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { extractJobData, calculateMatchScore, generateCoverLetter, searchJobs, mutateResume, createStrategyPlan, generateStrategyBrief, augmentResumeWithSkill, generateInterviewQuestions } from '../services/gemini.ts';
import { Job, UserProfile, MatchResult, ApplicationStatus, ApplicationLog, DiscoveredJob, CoverLetterStyle, RiskStatus, JobIntent, CommandResult, StrategyPlan } from '../types.ts';
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
  [ApplicationStatus.EXTRACTING]: { percent: 15, label: 'Extracting Job Intel...', color: 'bg-indigo-400', animation: 'animate-pulse' },
  [ApplicationStatus.MATCHING]: { percent: 35, label: 'Neural Matching...', color: 'bg-indigo-500', animation: 'animate-pulse' },
  [ApplicationStatus.AUGMENTING]: { percent: 50, label: 'Augmenting Profile Logic...', color: 'bg-purple-500', animation: 'animate-pulse' },
  [ApplicationStatus.GENERATING_CL]: { percent: 60, label: 'Synthesizing Cover Letter...', color: 'bg-indigo-600', animation: 'animate-pulse' },
  [ApplicationStatus.MUTATING_RESUME]: { percent: 85, label: 'Atomic Resume Mutation...', color: 'bg-indigo-700', animation: 'animate-pulse' },
  [ApplicationStatus.APPLYING]: { percent: 95, label: 'Bypassing Detection...', color: 'bg-indigo-800', animation: 'animate-bounce' },
  [ApplicationStatus.COMPLETED]: { percent: 100, label: 'Success: Application Dispatched', color: 'bg-green-500', animation: '' },
  [ApplicationStatus.FAILED]: { percent: 100, label: 'System Failure: Aborted', color: 'bg-red-500', animation: '' },
  [ApplicationStatus.RISK_HALT]: { percent: 100, label: 'Risk Protocol: Halted', color: 'bg-amber-500', animation: '' },
  [ApplicationStatus.INTERPRETING]: { percent: 10, label: 'Interpreting Command...', color: 'bg-indigo-300', animation: 'animate-pulse' },
  [ApplicationStatus.STRATEGIZING]: { percent: 20, label: 'Formulating Strategy...', color: 'bg-indigo-400', animation: 'animate-pulse' },
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

  useEffect(() => {
    if (activeStrategy) {
      if (activeStrategy.intensity === 'Aggressive') setSelectedStyle(CoverLetterStyle.RESULTS_DRIVEN);
      else if (activeStrategy.intensity === 'Precision') setSelectedStyle(CoverLetterStyle.TECHNICAL_DEEP_CUT);
      else setSelectedStyle(CoverLetterStyle.CHILL_PROFESSIONAL);
    }
  }, [activeStrategy?.intensity]);

  useEffect(() => {
    if (activeStrategy && logs.length > 5) {
      generateStrategyBrief(activeStrategy, logs).then(setStrategyBrief);
    }
  }, [activeStrategy, logs.length]);

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

  const toggleStrategyStatus = () => {
    if (!activeStrategy) return;
    const newStatus = activeStrategy.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
    onStrategyUpdate({ ...activeStrategy, status: newStatus });
    addLog(`⚙️ STRATEGY ${newStatus === 'PAUSED' ? 'HALTED' : 'RESUMED'}`);
  };

  const updateStrategyConfig = (updates: Partial<StrategyPlan>) => {
    if (!activeStrategy) return;
    onStrategyUpdate({ ...activeStrategy, ...updates });
    addLog(`⚙️ STRATEGY UPDATED: ${Object.keys(updates).join(', ')} adjusted.`);
  };

  const humanDelay = (min = 1500, max = 4500) => {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(r => setTimeout(r, delay));
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

  const handleIngest = (job: DiscoveredJob) => {
    setJobInput(job.url);
    addLog(`Ingesting ${job.title}...`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    processJob(job.url);
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

  const handleAugment = async (skill: string) => {
    if (!currentJob || isProcessing) return;
    setIsProcessing(true);
    setAutomationStep(ApplicationStatus.AUGMENTING);
    addLog(`🧬 AUGMENTATION INITIATED: Injecting "${skill}" into profile infrastructure...`);
    
    try {
      const targetTrack = profile.resumeTracks[0];
      if (!targetTrack) throw new Error("No resume tracks found to augment.");

      const augmentedResume = await augmentResumeWithSkill(targetTrack, skill, currentJob);
      
      const updatedProfile: UserProfile = {
        ...profile,
        resumeTracks: profile.resumeTracks.map(t => 
          t.id === targetTrack.id ? { ...t, content: augmentedResume } : t
        )
      };

      onProfileUpdate(updatedProfile);
      addLog(`✅ AUGMENTATION SUCCESS: Synced skill and synthetic experience for "${skill}".`);
      
      setAutomationStep(ApplicationStatus.MATCHING);
      const result = await calculateMatchScore(currentJob, updatedProfile);
      setMatch(result);
      addLog(`📈 NEW MATCH SCORE: ${result.score}%`);
      
    } catch (e) {
      addLog(`❌ AUGMENTATION FAILED: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setAutomationStep(ApplicationStatus.PENDING);
    }
  };

  const runBulkDeployment = async () => {
    if (discoveredJobs.length === 0 || risk.isLocked || isBulkActive) return;
    
    setIsBulkActive(true);
    setBulkProgress({ current: 0, total: discoveredJobs.length });
    stopBulkRef.current = false;
    addLog(`🚀 BULK MISSION INITIATED: Dispatched for ${discoveredJobs.length} listings.`);
    
    for (let i = 0; i < discoveredJobs.length; i++) {
      if (stopBulkRef.current) {
        addLog("🛑 BULK MISSION ABORTED BY USER.");
        break;
      }
      
      const targetJob = discoveredJobs[i];
      setBulkProgress(prev => ({ ...prev, current: i + 1 }));
      addLog(`--------------------------------------------------`);
      addLog(`📦 PROCESSING MISSION [${i+1}/${discoveredJobs.length}]: ${targetJob.title} at ${targetJob.company}`);
      
      try {
        setAutomationStep(ApplicationStatus.EXTRACTING);
        const jobData = await extractJobData(targetJob.url);
        setCurrentJob(jobData);
        
        setAutomationStep(ApplicationStatus.MATCHING);
        const matchResult = await calculateMatchScore(jobData, profile);
        setMatch(matchResult);
        addLog(`Match Score: ${matchResult.score}% - ${matchResult.score >= 75 ? 'Optimal' : 'Sub-optimal'}`);

        if (matchResult.score >= (profile.preferences.matchThreshold || 70)) {
          setAutomationStep(ApplicationStatus.MUTATING_RESUME);
          addLog(`Tailoring resume for ${jobData.company}...`);
          const mutation = await mutateResume(jobData, profile);
          
          setAutomationStep(ApplicationStatus.GENERATING_CL);
          addLog(`Synthesizing CV in ${selectedStyle} style...`);
          const cl = await generateCoverLetter(jobData, profile, selectedStyle);

          setAutomationStep(ApplicationStatus.APPLYING);
          addLog("Simulating human application dispatch...");
          await humanDelay(2000, 4000); // Simulate human delay

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
            mutationReport: mutation.report
          };
          onApply(logEntry);
          addLog(`✅ SUCCESS: Applied to ${jobData.company}`);
        } else {
          addLog(`⚠️ SKIPPED: Match score (${matchResult.score}%) below user threshold.`);
        }
      } catch (err) {
        addLog(`❌ FAILED: Error processing ${targetJob.company}. Moving to next.`);
      }

      // Buffer delay between missions
      await humanDelay(1500, 3000);
    }

    setIsBulkActive(false);
    setAutomationStep(ApplicationStatus.PENDING);
    addLog(`🏁 BULK MISSION COMPLETE: Final Audit Trail sync in progress.`);
  };

  const performRiskCheck = async (actionName: string) => {
    addLog(`[RiskShield] Scanning ${actionName}...`);
    await humanDelay(1000, 2000);
    const roll = Math.random();
    if (roll > 0.96) { setRisk(prev => ({ ...prev, level: 'HIGH' })); return false; }
    return true;
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
      if (!(await performRiskCheck("Navigation"))) throw new Error("Risk Threshold Exceeded");
      await humanDelay(3000, 5000);
      
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
        mutationReport: mutationResult.report
      };
      onApply(logEntry);
      setAutomationStep(ApplicationStatus.COMPLETED);
      setJobInput('');
    } catch (e) {
      setAutomationStep(ApplicationStatus.FAILED);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetRisk = () => { setRisk({ level: 'LOW', captchaCount: 0, domChangesDetected: false, ipReputation: 100, isLocked: false }); addLog("🛠️ SYSTEM RESET."); };

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
                    onClick={toggleStrategyStatus} 
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

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-y border-white/5 py-6 my-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Daily Quota</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" min="1" max="50" step="1"
                      value={activeStrategy.dailyQuota}
                      onChange={(e) => updateStrategyConfig({ dailyQuota: parseInt(e.target.value) })}
                      className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-white font-mono font-bold text-sm w-8 text-center">{activeStrategy.dailyQuota}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Intensity Profile</label>
                  <div className="flex bg-slate-950/50 p-1 rounded-lg gap-1 border border-white/5">
                    {(['Balanced', 'Precision', 'Aggressive'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => updateStrategyConfig({ intensity: lvl })}
                        className={`flex-1 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter transition-all ${
                          activeStrategy.intensity === lvl 
                            ? 'bg-indigo-600 text-white shadow-lg' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col justify-end">
                   <div className={`text-[10px] font-black uppercase tracking-widest text-right ${isPaused ? 'text-amber-500' : 'text-green-400'}`}>
                     Status: {isPaused ? 'Halted' : 'Optimizing Engine'}
                   </div>
                   <div className="text-[9px] text-slate-500 text-right mt-1 font-mono">Last Update: {new Date(activeStrategy.lastUpdate).toLocaleTimeString()}</div>
                </div>
             </div>

             <div className={`p-4 rounded-xl border text-xs leading-relaxed transition-all ${
               isPaused ? 'bg-amber-950/20 border-amber-900/30 text-amber-200/60' : 'bg-slate-950/50 border-slate-800/50 text-slate-300'
             }`}>
               <span className="font-bold mr-2 text-indigo-400">[BRIEF]</span>
               {isPaused ? `System suspended. All discovery and mutation processes are on standby.` : (strategyBrief || activeStrategy.explanation)}
             </div>
          </div>
        </div>
      )}

      {/* RISK SHIELD STATUS */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 grid grid-cols-4 gap-4 shadow-sm text-[10px] font-bold uppercase tracking-widest">
        <div className="space-y-1">Risk Protocol: <span className={risk.level === 'LOW' ? 'text-green-500' : 'text-red-500'}>{risk.level}</span></div>
        <div className="space-y-1">IP Reputation: <span className="text-indigo-600">{risk.ipReputation}%</span></div>
        <div className="space-y-1">System Lock: {risk.isLocked ? <span className="text-red-600">LOCKED</span> : 'ARMED'}</div>
        <div className="flex justify-end">
          {risk.isLocked && <button onClick={resetRisk} className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[9px] hover:bg-indigo-700">Override</button>}
        </div>
      </div>

      <header className="flex justify-between items-start pt-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Automation Runner</h2>
          <p className="text-slate-500 text-sm">Autonomous Applied Intelligence V3.0</p>
        </div>
        <button 
          onClick={discoverJobs} 
          disabled={isDiscovering || risk.isLocked || isBulkActive} 
          className={`px-6 py-3 rounded-2xl transition-all font-bold shadow-xl disabled:opacity-50 flex items-center gap-3 ${
            isDiscovering ? 'bg-indigo-500 text-white animate-pulse' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200'
          }`}
        >
          {isDiscovering ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Crawling Market...
            </>
          ) : (
            <>
              <Icons.Briefcase />
              Scrape Bulk Mission
            </>
          )}
        </button>
      </header>

      {/* BULK MISSION CONTROL PANEL */}
      {discoveredJobs.length > 0 && !currentJob && !isProcessing && (
        <div className="animate-in fade-in slide-in-from-top-4 space-y-4">
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h3 className="text-white text-xl font-black tracking-tight flex items-center gap-3">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
                    Bulk Deployment Ready
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">Staged <span className="text-indigo-400 font-bold">{discoveredJobs.length} tailored applications</span> for processing.</p>
                </div>
                
                {isBulkActive ? (
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Processing Batch</p>
                       <p className="text-white font-mono text-lg">{bulkProgress.current} / {bulkProgress.total}</p>
                    </div>
                    <button 
                      onClick={() => stopBulkRef.current = true}
                      className="bg-red-500/10 text-red-500 border border-red-500/20 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/20"
                    >
                      Abort Mission
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={runBulkDeployment}
                    className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-500/30 hover:bg-indigo-500 hover:-translate-y-1 active:translate-y-0 transition-all"
                  >
                    Initiate Bulk Deployment
                  </button>
                )}
              </div>
              
              {isBulkActive && (
                <div className="mt-8 space-y-2">
                   <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                        style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                      ></div>
                   </div>
                </div>
              )}
            </div>
          </div>

          {!isBulkActive && (
            <div className="grid grid-cols-1 gap-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Staged Queue</h3>
              {discoveredJobs.map((job, i) => (
                <div key={i} className="bg-white border border-slate-200 p-5 rounded-3xl hover:border-indigo-300 hover:shadow-lg transition-all flex items-center justify-between shadow-sm group border-l-4 border-l-slate-100 hover:border-l-indigo-500">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors text-base">{job.title}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-sm text-slate-500 font-medium">{job.company}</p>
                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                      <p className="text-xs text-slate-400 uppercase tracking-tighter">{job.source}</p>
                    </div>
                  </div>
                  <button onClick={() => handleIngest(job)} className="bg-indigo-50 text-indigo-600 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">Review Intel</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SINGLE JOB PANEL */}
      {(currentJob || isProcessing) && !isBulkActive && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in zoom-in-95 duration-500">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 flex flex-col space-y-8 relative overflow-hidden">
            <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest">Mission Payload</h3>
            
            {currentJob && (
              <div className="flex-1 space-y-6">
                <div>
                  <h4 className="font-black text-slate-900 text-2xl tracking-tighter">{currentJob.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-slate-500 font-bold">{currentJob.company}</p>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase">{currentJob.platform}</span>
                  </div>
                </div>

                {match && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Match Score</span>
                        <div className={`text-3xl font-black ${match.score >= 75 ? 'text-emerald-500' : 'text-amber-500'}`}>{match.score}%</div>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${match.score >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${match.score}%` }}></div>
                      </div>
                      <p className="text-xs text-slate-600 italic leading-relaxed font-medium">"{match.reasoning}"</p>
                    </div>
                  </div>
                )}
                
                <div className="space-y-3 pt-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Persona Style</label>
                  <select 
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value as CoverLetterStyle)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer appearance-none shadow-sm"
                    disabled={isProcessing}
                  >
                    {Object.values(CoverLetterStyle).map(style => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                </div>

                {isProcessing && automationStep !== ApplicationStatus.EXTRACTING && automationStep !== ApplicationStatus.MATCHING ? (
                  <div className="space-y-4 pt-4">
                    <div className="flex justify-between items-center text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">
                      <span className={currentStatus.animation}>{currentStatus.label}</span>
                      <span className="font-mono">{currentStatus.percent}%</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ease-out shadow-lg ${currentStatus.color}`}
                        style={{ width: `${currentStatus.percent}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-4 flex flex-col gap-4">
                    <div className="flex gap-4">
                      <button 
                        onClick={startAutomation} 
                        disabled={isProcessing || !match || risk.isLocked} 
                        className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-200"
                      >
                        Execute Apply Cycle
                      </button>
                      <button 
                        onClick={() => { setCurrentJob(null); setMatch(null); setLogs([]); setAutomationStep(ApplicationStatus.PENDING); }} 
                        className="px-8 py-4 border-2 border-slate-100 rounded-2xl hover:bg-slate-50 text-slate-500 font-bold text-xs uppercase"
                      >
                        Discard
                      </button>
                    </div>
                    <button 
                      onClick={handlePrepareInterview}
                      disabled={isPreparingInterview || isProcessing || !match}
                      className="w-full border-2 border-indigo-600 text-indigo-600 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50 transition-all flex items-center justify-center gap-3"
                    >
                      {isPreparingInterview ? "Coaching..." : "Prepare Interview Brief"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-slate-900 rounded-3xl p-8 font-mono text-[11px] overflow-hidden flex flex-col min-h-[500px] shadow-2xl text-slate-300 border border-slate-800 relative">
            <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Mission Telemetry</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2.5 scrollbar-hide">
              {logs.map((log, i) => (
                <div key={i} className={`py-1.5 border-l-2 pl-4 transition-all animate-in fade-in slide-in-from-left-4 ${
                  log.includes('SUCCESS') ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5' : 
                  log.includes('Initiated') || log.includes('PROCESSING') ? 'text-indigo-400 border-indigo-500 font-bold bg-indigo-500/5' : 
                  log.includes('FAILED') ? 'text-red-400 border-red-500 bg-red-500/5' : 'border-slate-800'
                }`}>
                  {log}
                </div>
              ))}
              {isProcessing && <div className="text-indigo-500 animate-pulse ml-4 mt-4 font-black">AGENT_EXECUTING_TASK...</div>}
            </div>
          </div>
        </div>
      )}

      {/* MISSION LOGS FOR BULK MODE */}
      {isBulkActive && (
        <div className="bg-slate-900 rounded-3xl p-8 font-mono text-[11px] overflow-hidden flex flex-col min-h-[500px] shadow-2xl text-slate-300 border border-slate-800 animate-in slide-in-from-bottom-8">
           <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Active Bulk Mission Telemetry</span>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse delay-75"></div>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse delay-150"></div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2.5 scrollbar-hide">
              {logs.slice(-50).map((log, i) => (
                <div key={i} className={`py-1.5 border-l-2 pl-4 transition-all animate-in fade-in slide-in-from-left-4 ${
                  log.includes('SUCCESS') ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5' : 
                  log.includes('PROCESSING') ? 'text-indigo-400 border-indigo-500 font-bold bg-indigo-500/5' : 
                  log.includes('FAILED') ? 'text-red-400 border-red-500 bg-red-500/5' : 
                  log.includes('Initiated') ? 'text-white font-black' : 'border-slate-800'
                }`}>
                  {log}
                </div>
              ))}
            </div>
        </div>
      )}

      {/* Manual Ingestion (Hidden during bulk) */}
      {!isBulkActive && discoveredJobs.length === 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 flex flex-col gap-5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Manual Intelligence Ingestion</label>
          <textarea 
            placeholder="Paste job link or raw description..." 
            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px] text-slate-800 transition-all text-sm" 
            value={jobInput} 
            onChange={(e) => setJobInput(e.target.value)} 
            disabled={risk.isLocked || isProcessing}
          />
          <button 
            onClick={() => processJob()} 
            disabled={isProcessing || !jobInput || risk.isLocked} 
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs"
          >
            {isProcessing ? 'Parsing...' : 'Deep Profile Correlation'}
          </button>
        </div>
      )}

      {/* INTERVIEW PREP MODAL */}
      {interviewQuestions && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-500">
          <div className="bg-white rounded-[2rem] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
              <h3 className="font-black text-2xl tracking-tighter">Interview Intelligence</h3>
              <button onClick={() => setInterviewQuestions(null)} className="p-2 hover:bg-white/10 rounded-full">
                 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-10 bg-slate-50">
              {interviewQuestions.map((q, i) => (
                <div key={i} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                   <div className="p-6 bg-slate-50 border-b border-slate-100">
                      <h4 className="font-black text-slate-900 text-base">{q.question}</h4>
                   </div>
                   <div className="p-8 space-y-6">
                      <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Psychological Intent</div>
                        <p className="text-xs text-slate-600 italic border-l-4 border-indigo-200 pl-4">{q.context}</p>
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Strategic Suggested Answer</div>
                        <p className="text-sm text-slate-800 leading-relaxed font-bold bg-indigo-50 p-5 rounded-2xl border border-indigo-100">{q.suggestedAnswer}</p>
                      </div>
                   </div>
                </div>
              ))}
            </div>
            <div className="p-8 bg-white border-t border-slate-100 flex justify-end">
              <button onClick={() => setInterviewQuestions(null)} className="bg-indigo-600 text-white px-12 py-4 rounded-2xl font-black uppercase text-xs">Mission Brief Absorbed</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobHunter;
