
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, ResumeTrack, Project } from '../types';
import { parseResume } from '../services/gemini';
import { jsPDF } from 'jspdf';

interface ProfileEditorProps {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({ profile, onSave }) => {
  const [editedProfile, setEditedProfile] = useState(profile);
  const [isParsing, setIsParsing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (JSON.stringify(editedProfile) !== JSON.stringify(profile)) {
        setSaveStatus('saving');
        onSave(editedProfile);
        setSaveStatus('saved');
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [editedProfile, onSave, profile]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        const mimeType = file.type;
        
        try {
          const fullParsedData = await parseResume(base64String, mimeType);
          
          const newTrack: ResumeTrack = {
            id: Math.random().toString(36).substr(2, 9),
            name: `Track: ${fullParsedData.fullName || 'Untitled'}`,
            content: fullParsedData.resumeJson
          };

          setEditedProfile(prev => ({
            ...prev,
            fullName: fullParsedData.fullName || prev.fullName,
            email: fullParsedData.email || prev.email,
            phone: fullParsedData.phone || prev.phone,
            linkedin: fullParsedData.linkedin || prev.linkedin,
            portfolio: fullParsedData.portfolio || prev.portfolio,
            resumeTracks: [...(prev.resumeTracks || []), newTrack]
          }));
          
          setSaveStatus('saved');
        } catch (err) {
          alert("Failed to parse resume.");
          setSaveStatus('error');
        } finally {
          setIsParsing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setIsParsing(false);
    }
  };

  const removeTrack = (id: string) => {
    setEditedProfile(prev => ({
      ...prev,
      resumeTracks: prev.resumeTracks.filter(t => t.id !== id)
    }));
  };

  const updateTrackJson = (id: string, jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      setEditedProfile(prev => ({
        ...prev,
        resumeTracks: prev.resumeTracks.map(t => t.id === id ? { ...t, content: parsed } : t)
      }));
    } catch (e) {
      setSaveStatus('error');
    }
  };

  const addProjectToTrack = (trackId: string) => {
    const newProject: Project = {
      name: "New Impact Project",
      description: "Explain the high-level goal and your specific contributions here.",
      technologies: ["Tech Stack"]
    };

    setEditedProfile(prev => ({
      ...prev,
      resumeTracks: prev.resumeTracks.map(t => {
        if (t.id === trackId) {
          return {
            ...t,
            content: {
              ...t.content,
              projects: [...(t.content.projects || []), newProject]
            }
          };
        }
        return t;
      })
    }));
  };

  const downloadBaseTrack = (track: ResumeTrack) => {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - (margin * 2);
    let y = margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(editedProfile.fullName, margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${editedProfile.email} | ${editedProfile.phone} | ${editedProfile.linkedin}`, margin, y);
    y += 15;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Profile Summary', margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryLines = doc.splitTextToSize(track.content.summary, maxWidth);
    doc.text(summaryLines, margin, y);
    y += (summaryLines.length * 5) + 12;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Experience', margin, y);
    y += 8;
    (track.content.experience || []).forEach(exp => {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${exp.role} @ ${exp.company}`, margin, y);
      y += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      (exp.achievements || []).forEach(ach => {
        const achLines = doc.splitTextToSize(`- ${ach}`, maxWidth - 5);
        doc.text(achLines, margin + 5, y);
        y += (achLines.length * 5);
      });
      y += 6;
    });

    doc.save(`${track.name.replace(/\s+/g, '_')}_Base.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Agent Identity Engine</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-500 text-sm">Manage your career tracks and persona.</p>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <div className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saving' ? 'bg-amber-400 animate-pulse' : saveStatus === 'saved' ? 'bg-green-500' : 'bg-slate-300'}`}></div>
              <span className="text-slate-400">{saveStatus === 'saving' ? 'Syncing...' : 'Synced'}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <input type="file" className="hidden" ref={fileInputRef} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt" onChange={handleFileUpload}/>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
            className="bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-3 rounded-2xl transition-all font-bold shadow-xl flex items-center gap-3 active:scale-95 disabled:opacity-50"
          >
            {isParsing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            )}
            {isParsing ? 'Neural Parsing...' : 'Import Base Resume'}
          </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 space-y-10">
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
             <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
             <h3 className="text-xl font-black text-slate-800 tracking-tight">Cloud Identity (Basic Info)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Legal Full Name</label>
              <input
                type="text"
                value={editedProfile.fullName}
                onChange={(e) => setEditedProfile({...editedProfile, fullName: e.target.value})}
                placeholder="John Doe"
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Email</label>
              <input
                type="email"
                value={editedProfile.email}
                onChange={(e) => setEditedProfile({...editedProfile, email: e.target.value})}
                placeholder="contact@example.com"
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
              <input
                type="text"
                value={editedProfile.phone}
                onChange={(e) => setEditedProfile({...editedProfile, phone: e.target.value})}
                placeholder="+1 (555) 000-0000"
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">LinkedIn Profile URL</label>
              <input
                type="text"
                value={editedProfile.linkedin}
                onChange={(e) => setEditedProfile({...editedProfile, linkedin: e.target.value})}
                placeholder="linkedin.com/in/username"
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Portfolio / Website</label>
              <input
                type="text"
                value={editedProfile.portfolio}
                onChange={(e) => setEditedProfile({...editedProfile, portfolio: e.target.value})}
                placeholder="portfolio.dev"
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 transition-all"
              />
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
             <div className="flex items-center gap-3">
               <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
               <h3 className="text-xl font-black text-slate-800 tracking-tight">Golden Base Resumes</h3>
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Target Profiles: {editedProfile.resumeTracks?.length || 0}</p>
          </div>
          <div className="space-y-10">
            {editedProfile.resumeTracks?.map((track) => (
              <div key={track.id} className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 relative group transition-all hover:border-indigo-200 hover:shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={track.name}
                      onChange={(e) => setEditedProfile({
                        ...editedProfile,
                        resumeTracks: editedProfile.resumeTracks.map(t => t.id === track.id ? { ...t, name: e.target.value } : t)
                      })}
                      className="bg-transparent font-black text-slate-900 text-xl border-none focus:ring-0 p-0 w-full"
                    />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Track Identifier</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => downloadBaseTrack(track)}
                      className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Download Base
                    </button>
                    <button 
                      onClick={() => addProjectToTrack(track.id)}
                      className="bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                      Add Project
                    </button>
                    <button 
                      onClick={() => removeTrack(track.id)} 
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Remove Track"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Structured JSON Intelligence</label>
                  <textarea
                    key={JSON.stringify(track.content)} 
                    defaultValue={JSON.stringify(track.content, null, 2)}
                    onBlur={(e) => updateTrackJson(track.id, e.target.value)}
                    className="w-full bg-slate-900 text-indigo-400 p-6 rounded-2xl font-mono text-[11px] h-80 shadow-inner outline-none focus:ring-2 focus:ring-indigo-500 transition-all scrollbar-hide"
                  />
                  <p className="text-[9px] text-slate-400 font-medium italic text-right px-2">Cloud-syncing JSON payload in real-time.</p>
                </div>
              </div>
            ))}
            {(!editedProfile.resumeTracks || editedProfile.resumeTracks.length === 0) && (
              <div className="flex flex-col items-center justify-center py-20 border-4 border-dashed border-slate-100 rounded-[3rem] text-slate-300">
                <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <p className="font-black uppercase tracking-widest text-xs">Awaiting Identity Upload</p>
                <p className="text-[10px] font-bold mt-2">Upload a PDF or DOCX to initialize your career tracks.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProfileEditor;
