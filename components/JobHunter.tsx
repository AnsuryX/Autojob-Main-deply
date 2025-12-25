
import React, { useState, useCallback, useEffect } from 'react';
import { extractJobData, calculateMatchScore, generateCoverLetter, searchJobs, mutateResume, createStrategyPlan, generateStrategyBrief } from '../services/gemini.ts';
import { Job, UserProfile, MatchResult, ApplicationStatus, ApplicationLog, DiscoveredJob, CoverLetterStyle, RiskStatus, JobIntent, CommandResult, StrategyPlan } from '../types.ts';
import CommandTerminal from './CommandTerminal.tsx';

interface JobHunterProps {
  profile: UserProfile;
  activeStrategy: StrategyPlan | null;
  onApply: (log: ApplicationLog) => void;
  onStrategyUpdate: (plan: StrategyPlan | null) => void;
}

const JobHunter: React.FC<JobHunterProps> = ({ profile, activeStrategy, onApply, onStrategyUpdate }) => {
  const [jobInput, setJobInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredJobs, setDiscoveredJobs] = useState<DiscoveredJob[]>([]);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [automationStep, setAutomationStep] = useState<ApplicationStatus>(ApplicationStatus.PENDING);
  const [logs, setLogs] = useState<string[]>([]);
  const [strategyBrief, setStrategyBrief] = useState<string>('');

  const [risk, setRisk] = useState<RiskStatus>({
    level: 'LOW',
    captchaCount: 0,
    domChangesDetected: false,
    ipReputation: 98,
    isLocked: false
  });

  const addLog = useCallback((msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]), []);

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

  const humanDelay = (min = 1500, max = 4500) => {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(r => setTimeout(r, delay));
  };

  const discoverJobs = async () => {
    if (risk.isLocked) { addLog("🚨 OPERATION BLOCKED: High risk of detection."); return; }
    setIsDiscovering(true);
    try {
      const results = await searchJobs(profile.preferences);
      setDiscoveredJobs(results);
      addLog(`Found ${results.length} relevant listings.`);
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
    } finally {
      setIsProcessing(false);
    }
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
    if (currentJob.intent?.type !== JobIntent.REAL_HIRE) {
      if (!confirm(`Warning: Intent classified as ${currentJob.intent?.type}. Proceed?`)) return;
    }
    setIsProcessing(true);
    try {
      let chosenStyle = CoverLetterStyle.CHILL_PROFESSIONAL;
      if (activeStrategy?.intensity === 'Aggressive') chosenStyle = CoverLetterStyle.RESULTS_DRIVEN;
      if (activeStrategy?.intensity === 'Precision') chosenStyle = CoverLetterStyle.TECHNICAL_DEEP_CUT;
      
      setAutomationStep(ApplicationStatus.GENERATING_CL);
      const cl = await generateCoverLetter(currentJob, profile, chosenStyle);

      setAutomationStep(ApplicationStatus.MUTATING_RESUME);
      addLog("🔥 INITIATING DEEP RESUME MUTATION ENGINE (V2.1)...");
      addLog("🧠 Step 1: Comparing JD against all Golden Base Resumes...");
      const mutationResult = await mutateResume(currentJob, profile);
      addLog(`🎯 Track Selected: "${mutationResult.report.selectedTrackName}"`);
      addLog("🔍 Step 2: Linguistic Mirroring & Keyword Injection...");
      addLog(`✅ Mutation Success: Injected ${mutationResult.report.keywordsInjected.length} keywords.`);
      addLog(`🔄 Reordered content for maximum relevance.`);
      addLog(`📈 ATS Confidence: ${mutationResult.report.atsScoreEstimate}%`);
      
      setAutomationStep(ApplicationStatus.APPLYING);
      addLog("Starting human-simulated apply...");
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
        coverLetter: cl,
        coverLetterStyle: chosenStyle,
        mutatedResume: mutationResult.mutatedResume,
        mutationReport: mutationResult.report
      };
      onApply(logEntry);
      setAutomationStep(ApplicationStatus.COMPLETED);
      addLog("SUCCESS: Application submitted via simulated agent.");
      setJobInput('');
    } catch (e) {
      setAutomationStep(ApplicationStatus.FAILED);
      addLog(`ABORTED: ${e instanceof Error ? e.message : 'System error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetRisk = () => { setRisk({ level: 'LOW', captchaCount: 0, domChangesDetected: false, ipReputation: 100, isLocked: false }); addLog("🛠️ SYSTEM RESET."); };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <CommandTerminal onExecute={handleCommand} isProcessing={isProcessing} />
      {activeStrategy && (
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 rounded-2xl p-6 border border-indigo-500/30 shadow-2xl relative overflow-hidden group">
          <div className="relative z-10 space-y-4">
             <div className="flex justify-between items-start">
                <div>
                   <h3 className="text-indigo-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
                      Autonomous Strategy Mode (ASM)
                   </h3>
                   <h2 className="text-xl font-bold text-white mt-1 italic">"{activeStrategy.goal}"</h2>
                </div>
                <button onClick={() => onStrategyUpdate(null)} className="text-slate-500 hover:text-red-400 text-xs font-bold uppercase">Terminate</button>
             </div>
             <div className="grid grid-cols-3 gap-4 border-y border-slate-800 py-4 my-2 text-sm text-indigo-300 font-bold">
                <div>Intensity: {activeStrategy.intensity}</div>
                <div>Quota: {activeStrategy.dailyQuota}</div>
                <div className="text-right text-green-400">Optimizing...</div>
             </div>
             <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/50 text-slate-300 text-xs italic">
               {strategyBrief || activeStrategy.explanation}
             </div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 grid grid-cols-4 gap-4 shadow-sm text-[10px] font-bold uppercase tracking-wider">
        <div className="space-y-1">Risk: <span className={risk.level === 'LOW' ? 'text-green-500' : 'text-red-500'}>{risk.level}</span></div>
        <div className="space-y-1">IP Rep: <span className="text-indigo-600">{risk.ipReputation}%</span></div>
        <div className="space-y-1">Status: {risk.isLocked ? <span className="text-red-600">LOCKED</span> : 'CLEAR'}</div>
        {risk.isLocked && <button onClick={resetRisk} className="bg-indigo-600 text-white px-2 rounded">Reset</button>}
      </div>
      <header className="flex justify-between items-start pt-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Automation Runner</h2>
          <p className="text-slate-500 text-sm">Targeted Hunt Agent V2.1</p>
        </div>
        <button onClick={discoverJobs} disabled={isDiscovering || risk.isLocked} className="bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-2.5 rounded-xl transition-all font-semibold shadow-md disabled:opacity-50">
          {isDiscovering ? 'Searching...' : 'Scrape Opportunities'}
        </button>
      </header>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
        <textarea placeholder="Paste a job link here..." className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px] text-slate-800" value={jobInput} onChange={(e) => setJobInput(e.target.value)} disabled={risk.isLocked}/>
        <button onClick={() => processJob()} disabled={isProcessing || !jobInput || risk.isLocked} className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold py-3 px-6 rounded-xl shadow-md">
          {isProcessing ? 'Analyzing...' : 'Deep Profile Match'}
        </button>
      </div>
      {discoveredJobs.length > 0 && !currentJob && (
        <div className="grid grid-cols-1 gap-3">
          {discoveredJobs.map((job, i) => (
            <div key={i} className="bg-white border border-slate-200 p-4 rounded-2xl hover:border-indigo-300 transition-all flex items-center justify-between shadow-sm">
              <div><h4 className="font-bold text-slate-800">{job.title}</h4><p className="text-sm text-slate-500">{job.company}</p></div>
              <button onClick={() => handleIngest(job)} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold border border-indigo-100">Review</button>
            </div>
          ))}
        </div>
      )}
      {(currentJob || isProcessing) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col space-y-6">
            <h3 className="font-bold text-lg text-slate-900">Match Summary</h3>
            {currentJob && (
              <div className="flex-1 space-y-5">
                <div><h4 className="font-bold text-slate-800 text-xl">{currentJob.title}</h4><p className="text-slate-500">{currentJob.company}</p></div>
                {match && (
                  <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
                    <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-600">Compatibility</span><span className="font-bold text-indigo-600">{match.score}%</span></div>
                    <p className="text-xs text-slate-500 italic">"{match.reasoning}"</p>
                  </div>
                )}
                <div className="pt-4 flex gap-3">
                  <button onClick={startAutomation} disabled={isProcessing || !match || risk.isLocked} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50">Start Cycle</button>
                  <button onClick={() => { setCurrentJob(null); setMatch(null); setLogs([]); }} className="px-6 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-semibold">Discard</button>
                </div>
              </div>
            )}
            {!currentJob && isProcessing && <div className="flex-1 flex items-center justify-center py-12 text-slate-500 font-medium">Injecting context...</div>}
          </div>
          <div className="bg-slate-900 rounded-2xl p-6 font-mono text-xs overflow-hidden flex flex-col min-h-[400px] shadow-xl text-slate-300">
            <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-hide">
              {logs.map((log, i) => (
                <div key={i} className={`py-0.5 border-l-2 pl-3 transition-all ${
                  log.includes('SUCCESS') ? 'text-green-400 border-green-500' : 
                  log.includes('ASM') ? 'text-indigo-400 border-indigo-500 font-bold' : 
                  log.includes('Track Selected') ? 'text-amber-400 font-bold' : 'border-slate-800'
                }`}>
                  {log}
                </div>
              ))}
              {isProcessing && <div className="text-indigo-500 animate-pulse ml-3">AGENT_ACTIVE...</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobHunter;
