
import React, { useState } from 'react';
import { ApplicationLog, ApplicationStatus, CoverLetterStyle, UserProfile, ResumeJson } from '../types';
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

  const downloadCoverLetterPDF = (app: ApplicationLog) => {
    if (!app?.coverLetter) return;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - (margin * 2);

    doc.setFontSize(18);
    doc.text(`Cover Letter - ${app.jobTitle}`, margin, margin);
    doc.setFontSize(12);
    doc.text(`${app.company} | Applied on ${new Date(app.timestamp).toLocaleDateString()}`, margin, margin + 8);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Voice Style: ${app.coverLetterStyle || 'Standard'}`, margin, margin + 14);
    
    doc.setTextColor(0);
    doc.setFontSize(11);
    const splitText = doc.splitTextToSize(app.coverLetter, maxWidth);
    doc.text(splitText, margin, margin + 30);
    
    doc.save(`AutoJob_CoverLetter_${app.company.replace(/\s+/g, '_')}.pdf`);
  };

  const downloadResumePDF = (app: ApplicationLog) => {
    if (!app?.mutatedResume) return;
    const resume = app.mutatedResume;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - (margin * 2);
    let y = margin;

    // Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(profile?.fullName || 'Candidate', margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${profile?.email || ''} | ${profile?.phone || ''} | ${profile?.linkedin || ''}`, margin, y);
    y += 15;

    // Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryLines = doc.splitTextToSize(resume.summary || '', maxWidth);
    doc.text(summaryLines, margin, y);
    y += (summaryLines.length * 5) + 10;

    // Experience
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Experience', margin, y);
    y += 8;
    
    (resume.experience || []).forEach(exp => {
      if (y > 250) { doc.addPage(); y = margin; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${exp.role} at ${exp.company}`, margin, y);
      y += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(exp.duration, margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      (exp.achievements || []).forEach(ach => {
        if (y > 270) { doc.addPage(); y = margin; }
        const achLines = doc.splitTextToSize(`• ${ach}`, maxWidth - 5);
        doc.text(achLines, margin + 5, y);
        y += (achLines.length * 5);
      });
      y += 8;
    });

    // Projects
    const projects = resume.projects || [];
    if (projects.length > 0) {
      if (y > 250) { doc.addPage(); y = margin; }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Projects', margin, y);
      y += 8;
      projects.forEach(proj => {
        if (y > 250) { doc.addPage(); y = margin; }
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(proj.name, margin, y);
        y += 5;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const projDesc = doc.splitTextToSize(proj.description || '', maxWidth);
        doc.text(projDesc, margin, y);
        y += (projDesc.length * 5);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(`Tech: ${(proj.technologies || []).join(', ')}`, margin, y);
        y += 8;
      });
    }

    // Skills
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Skills', margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const skillText = (resume.skills || []).join(', ');
    const skillLines = doc.splitTextToSize(skillText, maxWidth);
    doc.text(skillLines, margin, y);

    doc.save(`AutoJob_Resume_${app.company.replace(/\s+/g, '_')}.pdf`);
  };

  const getTemplateStyles = () => {
    switch (template) {
      case 'modern': return { 
        container: 'font-sans',
        header: 'bg-slate-900 text-white p-10 flex flex-col items-center text-center', 
        accent: 'text-indigo-600', 
        card: 'bg-white border-slate-200 shadow-sm',
        sectionHeader: 'text-slate-900 font-black border-b-2 border-slate-100 pb-2 flex items-center gap-3',
        skillBadge: 'bg-indigo-50 text-indigo-700 border-indigo-100'
      };
      case 'startup': return { 
        container: 'font-sans',
        header: 'bg-indigo-600 text-white p-12 rounded-t-3xl', 
        accent: 'text-indigo-600', 
        card: 'bg-indigo-50 border-indigo-100 p-6 rounded-2xl',
        sectionHeader: 'text-indigo-600 font-bold tracking-tight pb-2 border-none',
        skillBadge: 'bg-white text-indigo-600 border-indigo-200'
      };
      case 'technical': return { 
        container: 'font-mono text-[13px]',
        header: 'bg-slate-50 text-slate-900 p-10 border-b border-slate-200', 
        accent: 'text-emerald-600', 
        card: 'bg-slate-50 border-slate-200 p-4 border-l-4 border-emerald-500',
        sectionHeader: 'text-slate-900 font-black uppercase tracking-widest bg-slate-100 p-2',
        skillBadge: 'bg-slate-900 text-emerald-400 border-slate-800'
      };
      default: return { // executive
        container: 'font-serif',
        header: 'bg-white text-slate-900 p-12 border-b-4 border-slate-900 flex flex-col md:flex-row justify-between items-center', 
        accent: 'text-slate-900', 
        card: 'bg-white border-slate-200 p-2',
        sectionHeader: 'text-slate-900 font-bold uppercase tracking-widest border-b border-slate-300 pb-1 mb-4',
        skillBadge: 'bg-slate-100 text-slate-800 border-slate-300 rounded-none'
      };
    }
  };

  const templateStyles = getTemplateStyles();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Application Audit Trail</h2>
          <p className="text-slate-500">Monitor your automated job search activity.</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-indigo-600">{safeApplications.length}</p>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-tighter">Total Applications</p>
        </div>
      </header>

      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setViewMode('audit')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'audit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Audit Log
        </button>
        <button 
          onClick={() => setViewMode('gallery')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'gallery' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Letter Gallery
        </button>
      </div>

      {viewMode === 'audit' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Job & Company</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Origin</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Persona</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Artifacts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {safeApplications.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">No applications found in cloud history.</td></tr>
              ) : (
                safeApplications.slice().reverse().map((app) => (
                  <tr key={app.id || Math.random()} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 flex items-center gap-2">
                        {app.jobTitle}
                        {app.url && (
                          <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{app.company} {app.location ? `• ${app.location}` : ''}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{app.platform || 'Direct'}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 uppercase italic">
                        {app.mutationReport?.selectedTrackName || 'Auto'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-4 text-xs font-bold items-center">
                        {app.mutatedResume && (
                          <button onClick={() => setSelectedResume(app)} className="text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-indigo-200 underline-offset-4">Resume</button>
                        )}
                        {app.coverLetter && (
                          <button onClick={() => setSelectedCL({ text: app.coverLetter!, style: app.coverLetterStyle || 'Default', app })} className="text-slate-400 hover:text-slate-600 transition-colors underline decoration-slate-200 underline-offset-4">Letter</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-300">
          {applicationsWithLetters.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-medium">
              No cover letters generated yet.
            </div>
          ) : (
            applicationsWithLetters.map((app) => (
              <div 
                key={app.id || Math.random()} 
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 leading-tight">{app.jobTitle}</h4>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{app.company}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border uppercase tracking-wider ${getStyleColor(app.coverLetterStyle)}`}>
                    {app.coverLetterStyle || 'Standard'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed italic line-clamp-3">"{app.coverLetter}"</p>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-[10px] text-slate-400">{new Date(app.timestamp).toLocaleDateString()}</span>
                  <button onClick={() => setSelectedCL({ text: app.coverLetter!, style: app.coverLetterStyle || 'Default', app })} className="text-xs font-bold text-indigo-600">Read Letter</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* FIXED RESUME MODAL - Handles null checks correctly */}
      {selectedResume && selectedResume.mutatedResume && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[60] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-6xl max-h-full overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300">
            <div className="p-4 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                  <Icons.User />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Resume Preview: {selectedResume.company}</h3>
                  <p className="text-[9px] text-indigo-300 font-bold uppercase tracking-widest">Persona: {selectedResume.mutationReport?.selectedTrackName || 'Auto-generated'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex bg-slate-800 p-1 rounded-xl">
                  {(['executive', 'modern', 'startup', 'technical'] as ResumeTemplateId[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setTemplate(t)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${template === t ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => downloadResumePDF(selectedResume)}
                  className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Export PDF
                </button>
                <button 
                  onClick={() => setSelectedResume(null)} 
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-100">
              {/* Sidebar Analysis */}
              <div className="w-full md:w-72 bg-white border-r border-slate-200 p-6 overflow-y-auto space-y-6 hidden md:block">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mutation Analysis</h4>
                {selectedResume.mutationReport ? (
                   <div className="space-y-6">
                      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <div className="text-2xl font-black text-indigo-700">{selectedResume.mutationReport.atsScoreEstimate}%</div>
                        <div className="text-[10px] font-bold text-indigo-500 uppercase">ATS Score Estimate</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Strategy</div>
                        <p className="text-[11px] text-slate-600 leading-relaxed italic">"{selectedResume.mutationReport.reorderingJustification}"</p>
                      </div>
                      <div className="space-y-2">
                         <div className="text-[10px] font-bold text-slate-400 uppercase">Keywords Injected</div>
                         <div className="flex flex-wrap gap-1">
                           {(selectedResume.mutationReport.keywordsInjected || []).map((k, i) => (
                             <span key={i} className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{k}</span>
                           ))}
                         </div>
                      </div>
                   </div>
                ) : <p className="text-xs text-slate-400 italic">No analysis data available.</p>}
              </div>

              {/* Template Rendering */}
              <div className={`flex-1 overflow-y-auto p-4 md:p-12 ${templateStyles.container}`}>
                <div className="max-w-4xl mx-auto bg-white shadow-2xl min-h-full flex flex-col">
                  {/* Template Header */}
                  <div className={templateStyles.header}>
                    <div>
                      <h1 className="text-3xl font-black tracking-tighter uppercase">{profile?.fullName}</h1>
                      <div className={`text-xs font-bold uppercase tracking-[0.2em] mt-2 ${templateStyles.accent}`}>
                        Senior Software Architect
                      </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-4 text-[11px] font-bold uppercase opacity-80">
                      <span>{profile?.email}</span>
                      <span>{profile?.phone}</span>
                      <span>{profile?.linkedin}</span>
                    </div>
                  </div>

                  <div className="p-10 space-y-12">
                    {/* Summary */}
                    <section>
                      <h2 className={templateStyles.sectionHeader}>Professional Summary</h2>
                      <p className="mt-4 text-[14px] leading-relaxed text-slate-700">{selectedResume.mutatedResume.summary}</p>
                    </section>

                    {/* Skills */}
                    <section>
                      <h2 className={templateStyles.sectionHeader}>Core Technologies</h2>
                      <div className="mt-6 flex flex-wrap gap-2">
                        {(selectedResume.mutatedResume.skills || []).map((s, i) => (
                          <span key={i} className={`px-4 py-2 border font-bold text-[11px] rounded-lg uppercase tracking-wider ${templateStyles.skillBadge}`}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </section>

                    {/* Experience */}
                    <section>
                      <h2 className={templateStyles.sectionHeader}>Career Progression</h2>
                      <div className="mt-8 space-y-10">
                        {(selectedResume.mutatedResume.experience || []).map((exp, i) => (
                          <div key={i}>
                            <div className="flex justify-between items-baseline mb-2">
                              <h3 className="font-bold text-lg text-slate-900">{exp.role}</h3>
                              <span className="text-[10px] font-black text-slate-400 uppercase">{exp.duration}</span>
                            </div>
                            <div className={`text-xs font-black uppercase tracking-widest mb-4 ${templateStyles.accent}`}>{exp.company}</div>
                            <ul className="space-y-3">
                              {(exp.achievements || []).map((ach, j) => (
                                <li key={j} className="text-[13px] text-slate-600 leading-relaxed flex gap-3">
                                  <span className="mt-2 w-1 h-1 bg-slate-300 rounded-full shrink-0"></span>
                                  {ach}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Projects */}
                    {selectedResume.mutatedResume.projects && selectedResume.mutatedResume.projects.length > 0 && (
                      <section>
                        <h2 className={templateStyles.sectionHeader}>Strategic Projects</h2>
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                          {selectedResume.mutatedResume.projects.map((proj, i) => (
                            <div key={i} className={templateStyles.card}>
                              <h4 className="font-bold text-sm mb-2">{proj.name}</h4>
                              <p className="text-[12px] text-slate-600 leading-relaxed mb-4">{proj.description}</p>
                              <div className="flex flex-wrap gap-1">
                                {(proj.technologies || []).map((t, k) => (
                                  <span key={k} className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold uppercase">{t}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COVER LETTER MODAL */}
      {selectedCL && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[60] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg leading-tight">Cover Letter Output</h3>
                <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-widest mt-1">Tone: {selectedCL.style}</p>
              </div>
              <button onClick={() => setSelectedCL(null)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-8 text-slate-700 whitespace-pre-wrap text-sm leading-relaxed overflow-y-auto max-h-[60vh] bg-slate-50 font-serif">
              {selectedCL.text}
            </div>
            <div className="p-4 bg-white border-t border-slate-100 flex justify-end gap-3">
               <button onClick={() => { navigator.clipboard.writeText(selectedCL.text); alert('Copied'); }} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">Copy</button>
               <button onClick={() => downloadCoverLetterPDF(selectedCL.app)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-lg">Save PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationTracker;
