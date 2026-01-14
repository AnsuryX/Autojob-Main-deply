
import React, { useState, useCallback } from 'react';
import { searchFreelanceGigs, generateProposal } from '../services/gemini.ts';
import { Gig, UserProfile } from '../types.ts';
import { Icons } from '../constants.tsx';

interface FreelanceGigsProps {
  profile: UserProfile;
}

const FreelanceGigs: React.FC<FreelanceGigsProps> = ({ profile }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [activeGig, setActiveGig] = useState<Gig | null>(null);
  const [proposal, setProposal] = useState<string | null>(null);
  const [isBidding, setIsBidding] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]), []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setLogs([]);
    addLog(`Initiating web crawl for freelance projects: "${query}"...`);
    try {
      const results = await searchFreelanceGigs(query);
      setGigs(results);
      addLog(`Discovery complete. Found ${results.length} active projects.`);
    } catch (e: any) {
      addLog(`Error during crawl: ${e.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const startBidding = async (gig: Gig) => {
    setActiveGig(gig);
    setIsBidding(true);
    setProposal(null);
    addLog(`Drafting high-conversion proposal for: ${gig.title}`);
    try {
      const p = await generateProposal(gig, profile);
      setProposal(p);
      addLog(`Proposal successfully drafted based on your expertise.`);
    } catch (e: any) {
      addLog(`Failed to draft proposal: ${e.message}`);
    } finally {
      setIsBidding(false);
    }
  };

  const copyProposal = () => {
    if (proposal) {
      navigator.clipboard.writeText(proposal);
      addLog(`Proposal copied to clipboard. Ready for paste on ${activeGig?.platform}.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          Freelance Gig Engine
        </h2>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search e.g. 'React Native developer Upwork'..."
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 transition-all pr-40"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !query}
            className="absolute right-2 top-2 bottom-2 bg-slate-900 hover:bg-black text-white px-5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all"
          >
            {isSearching ? 'Crawling...' : 'Find Gigs'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase text-slate-400 px-4 tracking-[0.2em]">Discovered Projects</p>
          <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 scrollbar-hide">
            {gigs.map((gig) => (
              <div 
                key={gig.id} 
                className={`bg-white border p-5 rounded-2xl flex flex-col gap-3 shadow-sm cursor-pointer transition-all hover:shadow-md ${activeGig?.id === gig.id ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200'}`}
                onClick={() => startBidding(gig)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-800 leading-tight">{gig.title}</h4>
                    <span className="text-[10px] font-black text-indigo-600 uppercase mt-1 inline-block">{gig.platform}</span>
                  </div>
                  {gig.budget && (
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold">{gig.budget}</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{gig.description}</p>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Available Now</span>
                  <button className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Draft Bid</button>
                </div>
              </div>
            ))}
            {gigs.length === 0 && !isSearching && (
              <div className="py-20 text-center border-4 border-dashed border-slate-100 rounded-[2rem]">
                 <p className="text-[10px] font-black text-slate-300 uppercase">No active projects loaded</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-950 rounded-[2rem] p-8 font-mono text-[10px] text-slate-500 shadow-2xl flex flex-col max-h-[300px]">
            <p className="text-emerald-400 font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 
              Freelance Telemetry
            </p>
            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
              {logs.map((log, i) => <div key={i} className="pl-3 border-l border-white/5 py-0.5">{log}</div>)}
              {logs.length === 0 && <div className="opacity-20 italic">Awaiting project selection...</div>}
            </div>
          </div>

          {activeGig && (
            <div className="bg-white border border-slate-200 rounded-[2rem] p-8 space-y-6 shadow-xl animate-in slide-in-from-right-8">
              <div>
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Active Bid Focus</span>
                <h3 className="text-xl font-black text-slate-900 mt-1">{activeGig.title}</h3>
                <p className="text-xs text-slate-400 font-bold mt-1">Platform: {activeGig.platform}</p>
              </div>

              {proposal ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 font-serif text-sm leading-relaxed text-slate-700 max-h-[250px] overflow-y-auto italic">
                    {proposal}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={copyProposal}
                      className="w-full bg-indigo-600 text-white p-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Icons.History /> Copy Proposal & Open {activeGig.platform}
                    </button>
                    <a 
                      href={activeGig.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-center text-[10px] font-bold text-slate-400 uppercase py-2 hover:underline"
                    >
                      View Original Posting
                    </a>
                  </div>
                </div>
              ) : isBidding ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
                  <p className="text-[10px] font-black text-indigo-600 uppercase animate-pulse">Drafting proposal...</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-10 italic">Select a project on the left to start bidding.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FreelanceGigs;
