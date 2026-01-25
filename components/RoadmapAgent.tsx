
import React, { useState, useEffect } from 'react';
import { generateCareerRoadmap } from '../services/gemini';
import { UserProfile, CareerRoadmap } from '../types';

interface RoadmapAgentProps {
  profile: UserProfile;
}

const RoadmapAgent: React.FC<RoadmapAgentProps> = ({ profile }) => {
  const [roadmap, setRoadmap] = useState<CareerRoadmap | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRoadmap = async () => {
    setIsLoading(true);
    try {
      const data = await generateCareerRoadmap(profile);
      setRoadmap(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm space-y-8">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Strategic Career Navigator</h2>
            <p className="text-slate-500 text-sm">Long-term gap analysis and market-driven evolution strategy.</p>
          </div>
          <button 
            onClick={fetchRoadmap}
            disabled={isLoading}
            className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoading ? 'Scanning Market...' : 'Generate Evolution Plan'}
          </button>
        </div>

        {roadmap ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4">Value Assessment</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Current Estimate</p>
                    <p className="text-xl font-black text-slate-900">{roadmap.currentMarketValue}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Target Potential</p>
                    <p className="text-xl font-black text-indigo-600">{roadmap.targetMarketValue}</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Neural Gap Analysis</p>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">"{roadmap.gapAnalysis}"</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Evolution Timeline</p>
              <div className="space-y-4 relative">
                <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-100"></div>
                {roadmap.steps?.map((step, i) => (
                  <div key={i} className="relative pl-12">
                    <div className="absolute left-[20px] top-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white shadow-sm z-10"></div>
                    <div className="bg-white border border-slate-100 p-5 rounded-2xl hover:border-indigo-200 transition-all shadow-sm">
                      <p className="text-[9px] font-black text-indigo-500 uppercase mb-1">{step.period}</p>
                      <h4 className="font-black text-slate-800 text-sm mb-2">{step.goal}</h4>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {step.skillGain?.map((s, j) => (
                          <span key={j} className="text-[8px] font-bold bg-slate-50 text-slate-500 px-2 py-0.5 rounded uppercase">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-24 text-center border-4 border-dashed border-slate-50 rounded-[3rem]">
            <p className="text-[10px] font-black text-slate-200 uppercase tracking-widest">Awaiting Strategic Dispatch</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoadmapAgent;
