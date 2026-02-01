
import React from 'react';
import { UserProfile, CareerRoadmap, TaskState } from '../types';

interface RoadmapAgentProps {
  profile: UserProfile;
  roadmap: CareerRoadmap | null;
  task: TaskState;
  onTrigger: () => void;
}

const RoadmapAgent: React.FC<RoadmapAgentProps> = ({ roadmap, task, onTrigger }) => {
  const isRunning = task.status === 'running';
  const isCompleted = task.status === 'completed';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-200 shadow-sm space-y-6 overflow-hidden relative">
        {/* Persistent Neural Progress Bar */}
        {isRunning && (
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100 overflow-hidden">
            <div 
              className="h-full bg-indigo-600 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(79,70,229,0.5)]"
              style={{ width: `${task.progress}%` }}
            ></div>
          </div>
        )}

        {/* Header Section: Tightened */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Strategic Career Navigator</h2>
              {isCompleted && (
                <span className="animate-success-pop flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[9px] font-black px-2.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-widest">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  Strategy Ready
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs font-medium">Market-driven evolution trajectory based on current benchmarks.</p>
          </div>
          <button 
            onClick={onTrigger}
            disabled={isRunning}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 ${isRunning ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-900 text-white hover:bg-black'}`}
          >
            {isRunning ? (
              <>
                <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                Agent Working...
              </>
            ) : isCompleted ? 'Regenerate Strategy' : 'Generate Evolution Plan'}
          </button>
        </div>

        {isRunning && (
          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 animate-pulse text-center">
            <p className="text-indigo-600 font-black text-[10px] uppercase tracking-widest">{task.message}</p>
          </div>
        )}

        {roadmap ? (
          <div className="space-y-6">
            {/* Top Row: Assessment Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 bg-indigo-50 p-5 rounded-2xl border border-indigo-100 flex flex-col justify-center">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Market Valuation</p>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Current</p>
                    <p className="text-lg font-black text-slate-900">{roadmap.currentMarketValue}</p>
                  </div>
                  <div className="h-8 w-px bg-indigo-200 mx-2"></div>
                  <div className="space-y-0.5 text-right">
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Potential</p>
                    <p className="text-lg font-black text-indigo-600">{roadmap.targetMarketValue}</p>
                  </div>
                </div>
              </div>
              
              <div className="lg:col-span-2 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Neural Gap Analysis</p>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium line-clamp-2 hover:line-clamp-none transition-all cursor-help">
                  {roadmap.gapAnalysis}
                </p>
              </div>
            </div>

            {/* Timeline Row: Grid based for compact viewing */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evolution Timeline</p>
                <div className="h-px flex-1 bg-slate-100"></div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {roadmap.steps?.map((step, i) => (
                  <div key={i} className="bg-white border border-slate-100 p-5 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all flex flex-col group relative overflow-hidden">
                    {/* Background Index Number */}
                    <div className="absolute -bottom-2 -right-2 text-slate-50 font-black text-6xl pointer-events-none group-hover:text-indigo-50 transition-colors">
                      {i + 1}
                    </div>
                    
                    <div className="relative z-10 flex flex-col h-full space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase">{step.period}</span>
                      </div>
                      
                      <h4 className="font-black text-slate-800 text-xs leading-tight mb-1">{step.goal}</h4>
                      
                      <div className="space-y-1.5 flex-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Focus Area</p>
                        <ul className="space-y-1">
                          {step.actionItems?.slice(0, 2).map((item, j) => (
                            <li key={j} className="text-[10px] text-slate-600 flex items-start gap-1.5 leading-tight">
                              <span className="w-1 h-1 rounded-full bg-slate-300 mt-1 shrink-0"></span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex flex-wrap gap-1 mt-auto pt-3 border-t border-slate-50">
                        {step.skillGain?.slice(0, 3).map((s, j) => (
                          <span key={j} className="text-[8px] font-bold bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded uppercase border border-slate-100">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : !isRunning && (
          <div className="py-16 text-center border-4 border-dashed border-slate-50 rounded-[2.5rem]">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A2 2 0 013 15.488V5.512a2 2 0 011.553-1.944L9 2m0 18l5.447-2.724A2 2 0 0016 15.488V5.512a2 2 0 01-1.553-1.944L9 2m0 18V2" /></svg>
            </div>
            <p className="text-[10px] font-black text-slate-200 uppercase tracking-widest">Awaiting Strategy Generation</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoadmapAgent;
