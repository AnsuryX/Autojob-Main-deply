import React, { useEffect, useState } from 'react';
import { Icons } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout?: () => void;
  isProcessing?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, onLogout, isProcessing }) => {
  const [showSuccessGlow, setShowSuccessGlow] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isProcessing && showSuccessGlow === false) {
      setShowSuccessGlow(true);
      const timer = setTimeout(() => setShowSuccessGlow(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isProcessing]);

  const tabs = [
    { id: 'discover', label: 'Discovery', icon: <Icons.Briefcase /> },
    { id: 'resume_lab', label: 'Resume Lab', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
    )},
    { id: 'roadmap', label: 'Evolution', icon: (
       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    )},
    { id: 'interview', label: 'Chamber', icon: (
       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
    )},
    { id: 'history', label: 'Telemetry', icon: <Icons.History /> },
    { id: 'profile', label: 'Identity', icon: <Icons.User /> },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 overflow-hidden h-screen">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">A</div>
           <span className="font-bold text-slate-800">AutoJob Cloud</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-500">
           {isSidebarOpen ? <Icons.Close /> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>}
        </button>
      </div>

      {/* Desktop / Mobile Sidebar Overlay */}
      <nav className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} fixed md:static inset-0 z-40 w-full md:w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-2 shrink-0 transition-transform duration-300 ease-in-out`}>
        <div className="hidden md:flex mb-8 px-2 items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-xl shadow-indigo-100">A</div>
          <h1 className="text-xl font-black tracking-tight text-slate-800">AutoJob <span className="text-indigo-600">Cloud</span></h1>
        </div>
        
        <div className="flex-1 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <div className={activeTab === tab.id ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}>
                {tab.icon}
              </div>
              <span className="text-sm tracking-tight">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto pt-6 space-y-4 border-t border-slate-50">
          <div className={`p-4 rounded-3xl border shadow-2xl overflow-hidden relative transition-all duration-500 glass-hud`}>
            <div className="flex justify-between items-center mb-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ASM HUD</p>
              <div className="flex items-center gap-1.5">
                 <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-indigo-400 animate-ping' : 'bg-emerald-400'}`}></div>
                 <span className={`text-[10px] font-black uppercase ${isProcessing ? 'text-indigo-400' : 'text-emerald-400'}`}>
                    {isProcessing ? 'Active' : 'Standby'}
                 </span>
              </div>
            </div>
            
            <div className="flex items-end gap-2">
               <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                 <div className={`h-full transition-all duration-1000 ${isProcessing ? 'w-full bg-indigo-500 animate-pulse' : 'w-2/5 bg-emerald-500'}`}></div>
               </div>
               <span className="text-[9px] font-mono text-slate-500">{isProcessing ? '3.5s' : '0.0s'}</span>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all text-xs font-black uppercase tracking-widest"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Terminate
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative bg-white md:bg-slate-50">
        <div className="md:p-10 p-4 max-w-5xl mx-auto">
          {children}
        </div>
        
        {/* Floating Agent Pulse Widget (HUD Accessory) */}
        {isProcessing && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 md:left-auto md:right-10 md:translate-x-0 z-50">
             <div className="glass-hud px-6 py-3 rounded-full flex items-center gap-4 shadow-2xl border border-white/10 animate-in slide-in-from-bottom-10">
                <div className="relative">
                   <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></div>
                   <div className="absolute inset-0 w-2.5 h-2.5 bg-indigo-500 rounded-full pulse-ring"></div>
                </div>
                <span className="text-[11px] font-black text-white uppercase tracking-widest whitespace-nowrap">Agent Synthesis in Progress</span>
                <div className="w-8 h-px bg-white/20"></div>
                <span className="text-[10px] font-mono text-indigo-400">Task_ID: 0xFD2</span>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Layout;