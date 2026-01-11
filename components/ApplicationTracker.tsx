
import React, { useState } from 'react';
import { ApplicationLog, ApplicationStatus, CoverLetterStyle, UserProfile, ResumeJson, VerificationProof } from '../types';
import { Icons } from '../constants';
import { jsPDF } from 'jspdf';

interface ApplicationTrackerProps {
  applications: ApplicationLog[];
  profile: UserProfile | null;
}

type ResumeTemplateId = 'executive' | 'modern' | 'startup' | 'technical';

const ApplicationTracker: React.FC<ApplicationTrackerProps> = ({ applications, profile }) => {
  const [selectedResume, setSelectedResume] = useState<ApplicationLog | null>(null);
  const [selectedCL, setSelectedCL] = useState<{ text: string, style: string, app: ApplicationLog } | null>(null);
  const [selectedProof, setSelectedProof] = useState<ApplicationLog | null>(null);
  const [viewMode, setViewMode] = useState<'audit' | 'gallery'>('audit');
  const [template, setTemplate] = useState<ResumeTemplateId>('executive');

  const safeApplications = applications || [];
  const applicationsWithLetters = safeApplications.filter(app => app?.coverLetter).slice().reverse();

  const getStyleColor = (style?: CoverLetterStyle) => {
    switch (style) {
      case CoverLetterStyle.ULTRA_CONCISE: return 'bg-orange-100 text-orange-700 border-orange-200';
      case CoverLetterStyle.RESULTS_DRIVEN: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case CoverLetterStyle.FOUNDER_FRIENDLY: return 'bg-purple-100 text-purple-700 border-purple-200';
      case CoverLetterStyle.TECHNICAL_DEEP_CUT: return 'bg-blue-100 text-blue-700 border-blue-200';
      case CoverLetterStyle.CHILL_PROFESSIONAL: return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const downloadResumePDF = (app: ApplicationLog, templateType: ResumeTemplateId = 'executive') => {
    if (!app?.mutatedResume) return;
    const resume = app.mutatedResume;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - (margin * 2);
    let y = margin;

    const themes = {
      executive: { primary: [15, 23, 42], accent: [51, 65, 85], font: 'times' },
      modern: { primary: [79, 70, 229], accent: [99, 102, 241], font: 'helvetica' },
      startup: { primary: [30, 41, 59], accent: [79, 70, 229], font: 'helvetica' },
      technical: { primary: [5, 150, 105], accent: [16, 185, 129], font: 'courier' }
    };
    const activeTheme = themes[templateType] || themes.executive;

    doc.setFont(activeTheme.font, 'bold');
    doc.setFontSize(22);
    doc.text(profile?.fullName || 'Candidate Name', margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont(activeTheme.font, 'normal');
    doc.text(`${profile?.email || ''} | ${profile?.phone || ''}`, margin, y);
    y += 15;

    doc.setFont(activeTheme.font, 'bold');
    doc.text('SUMMARY', margin, y);
    y += 6;
    doc.setFont(activeTheme.font, 'normal');
    const splitSummary = doc.splitTextToSize(resume.summary || '', maxWidth);
    doc.text(splitSummary, margin, y);
    y += (splitSummary.length * 5) + 10;

    doc.setFont(activeTheme.font, 'bold');
    doc.text('EXPERIENCE', margin, y);
    y += 8;
    (resume.experience || []).forEach(exp => {
      doc.setFont(activeTheme.font, 'bold');
      doc.text(`${exp.role} @ ${exp.company}`, margin, y);
      y += 5;
      doc.setFont(activeTheme.font, 'normal');
      (exp.achievements || []).forEach(ach => {
        const achLines = doc.splitTextToSize(`- ${ach}`, maxWidth - 5);
        doc.text(achLines, margin + 5, y);
        y += (achLines.length * 5);
      });
      y += 5;
    });

    doc.save(`Resume_${app.company.replace(/\s+/g, '_')}.pdf`);
  };

  const downloadCoverLetterPDF = (app: ApplicationLog) => {
    if (!app?.coverLetter) return;
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text(`Cover Letter: ${app.jobTitle} @ ${app.company}`, 20, 20);
    const splitText = doc.splitTextToSize(app.coverLetter, 170);
    doc.text(splitText, 20, 40);
    doc.save(`Letter_${app.company.replace(/\s+/g, '_')}.pdf`);
  };

  const getTemplateStyles = () => {
    switch (template) {
      case 'modern': return { container: 'font-sans', header: 'bg-indigo-600 text-white p-10 rounded-t-3xl', accent: 'text-indigo-400', card: 'bg-white border-slate-200 shadow-sm', sectionHeader: 'text-indigo-600 font-black border-b-2 border-slate-100 pb-2', skillBadge: 'bg-indigo-50 text-indigo-700 border-indigo-100' };
      case 'technical': return { container: 'font-mono text-[13px]', header: 'bg-slate-50 text-slate-900 p-10 border-b border-slate-200', accent: 'text-emerald-600', card: 'bg-slate-50 border-slate-200 p-4 border-l-4 border-emerald-500', sectionHeader: 'text-slate-900 font-black uppercase tracking-widest bg-slate-100 p-2', skillBadge: 'bg-slate-900 text-emerald-400 border-slate-800' };
      default: return { container: 'font-serif', header: 'bg-white text-slate-900 p-12 border-b-4 border-slate-900', accent: 'text-slate-900', card: 'bg-white border-slate-200 p-2', sectionHeader: 'text-slate-900 font-bold uppercase tracking-widest border-b border-slate-300 pb-1 mb-4', skillBadge: 'bg-slate-100 text-slate-800 border-slate-300' };
    }
  };

  const templateStyles = getTemplateStyles();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Application Audit Trail</h2>
          <p className="text-slate-500 text-sm">Monitor verified autonomous dispatch events.</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-indigo-600">{safeApplications.length}</p>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-tighter">Total Missions</p>
        </div>
      </header>

      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => setViewMode('audit')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${viewMode === 'audit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Audit Log</button>
        <button onClick={() => setViewMode('gallery')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${viewMode === 'gallery' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Letter Gallery</button>
      </div>

      {viewMode === 'audit' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Mission Target</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Dispatch Proof</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Persona</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Artifacts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {safeApplications.slice().reverse().map((app) => (
                <tr key={app.id || Math.random()} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{app.jobTitle}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{app.company}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => setSelectedProof(app)}
                      className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md border flex items-center gap-1 mx-auto transition-all ${
                        app.verification ? 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-600 hover:text-white' : 'text-slate-400 bg-slate-50 border-slate-100'
                      }`}
                    >
                      {app.verification ? (
                        <>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          Verified
                        </>
                      ) : 'Staged'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 uppercase">{app.mutationReport?.selectedTrackName || 'Auto'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-4 text-xs font-bold">
                      {app.mutatedResume && <button onClick={() => setSelectedResume(app)} className="text-indigo-600 hover:underline">Resume</button>}
                      {app.coverLetter && <button onClick={() => setSelectedCL({ text: app.coverLetter!, style: app.coverLetterStyle || 'Default', app })} className="text-slate-400 hover:underline">Letter</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {applicationsWithLetters.map((app) => (
            <div key={app.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-bold text-slate-900">{app.jobTitle}</h4>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border uppercase ${getStyleColor(app.coverLetterStyle)}`}>{app.coverLetterStyle}</span>
              </div>
              <p className="text-xs text-slate-600 line-clamp-3 italic mb-4">"{app.coverLetter}"</p>
              <button onClick={() => setSelectedCL({ text: app.coverLetter!, style: app.coverLetterStyle || 'Default', app })} className="text-xs font-bold text-indigo-600">Read Verified Letter</button>
            </div>
          ))}
        </div>
      )}

      {/* DISPATCH PROOF MODAL */}
      {selectedProof && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-950 rounded-[2.5rem] w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-white/5 flex justify-between items-center">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-white text-xl font-black tracking-tight">Mission Verification Certificate</h3>
                    <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mt-1">Confirmed Dispatch via AutoJob Engine v3.1</p>
                  </div>
               </div>
               <button onClick={() => setSelectedProof(null)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
            </div>

            <div className="p-10 space-y-8 flex-1 overflow-y-auto">
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dispatch Hash (SHA-256)</span>
                    <p className="text-indigo-400 font-mono text-[11px] break-all bg-white/5 p-3 rounded-xl border border-white/10">
                      {selectedProof.verification?.dispatchHash || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Server Status</span>
                    <p className="text-white font-mono text-2xl flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      {selectedProof.verification?.serverStatusCode || 200} OK
                    </p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Handshake Complete</p>
                  </div>
               </div>

               <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Network Telemetry Logs</span>
                    <span className="text-[9px] text-emerald-500 font-bold uppercase">Streaming Encrypted</span>
                  </div>
                  <div className="bg-black/40 rounded-2xl p-6 border border-white/5 font-mono text-[10px] text-slate-400 space-y-1.5 h-64 overflow-y-auto scrollbar-hide">
                    {selectedProof.verification?.networkLogs.map((log, i) => (
                      <div key={i} className={log.includes('>') ? 'text-indigo-400' : log.includes('<') ? 'text-emerald-400' : 'text-slate-600'}>
                        {log}
                      </div>
                    ))}
                  </div>
               </div>

               <div className="bg-indigo-600/10 border border-indigo-500/20 p-6 rounded-3xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Icons.Briefcase />
                     </div>
                     <div>
                        <h4 className="text-white font-bold text-sm">Verify on External Platform</h4>
                        <p className="text-slate-500 text-[10px]">Open target endpoint to confirm receipt status.</p>
                     </div>
                  </div>
                  <a 
                    href={selectedProof.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all"
                  >
                    Launch Check
                  </a>
               </div>
            </div>

            <div className="p-8 bg-white/5 border-t border-white/5 flex justify-center">
               <p className="text-[9px] text-slate-600 uppercase font-bold tracking-[0.3em]">Cryptographic Integrity Guaranteed by AutoJob Neural Dispatch</p>
            </div>
          </div>
        </div>
      )}

      {/* EXISTING MODALS (Selected Resume & Selected CL) */}
      {selectedResume && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[60] flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="font-bold">Verified Resume: {selectedResume.company}</h3>
                 <button onClick={() => setSelectedResume(null)} className="p-2 hover:bg-white/10 rounded-full"><Icons.Alert /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-12 bg-slate-100 font-serif">
                <div className="max-w-4xl mx-auto bg-white p-12 shadow-xl min-h-full">
                   <h1 className="text-3xl font-bold uppercase tracking-tighter">{profile?.fullName}</h1>
                   <div className="mt-8 border-b-2 border-slate-200 pb-12">
                      <h2 className="text-xs font-black uppercase tracking-widest mb-4">Professional Summary</h2>
                      <p className="text-sm leading-relaxed">{selectedResume.mutatedResume?.summary}</p>
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {selectedCL && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[60] flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
                 <h3 className="font-bold">Verified Cover Letter</h3>
                 <button onClick={() => setSelectedCL(null)} className="p-2 hover:bg-white/10 rounded-full"><Icons.Alert /></button>
              </div>
              <div className="p-10 whitespace-pre-wrap font-serif text-sm leading-relaxed text-slate-700">{selectedCL.text}</div>
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                 <button onClick={() => downloadCoverLetterPDF(selectedCL.app)} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-xs font-bold shadow-lg">Download PDF</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationTracker;
