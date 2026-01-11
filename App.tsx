
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import ProfileEditor from './components/ProfileEditor.tsx';
import JobHunter from './components/JobHunter.tsx';
import ApplicationTracker from './components/ApplicationTracker.tsx';
import Auth from './components/Auth.tsx';
import { AppState, ApplicationLog, UserProfile, StrategyPlan, ApplicationStatus } from './types.ts';
import { DEFAULT_PROFILE } from './constants.tsx';
import { supabase } from './lib/supabase.ts';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('discover');
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<AppState>({ 
    profile: null, 
    applications: [], 
    activeStrategy: null 
  });

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      })
      .catch(err => {
        console.error("Supabase Auth Error:", err);
        setError(`Identity system offline: ${err.message || 'Unknown Error'}`);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setError(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    const fetchCloudData = async () => {
      try {
        let { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') throw profileError;

        if (!profileData) {
          const initial = {
            id: session.user.id,
            full_name: DEFAULT_PROFILE.fullName,
            email: session.user.email,
            phone: DEFAULT_PROFILE.phone,
            linkedin: DEFAULT_PROFILE.linkedin,
            portfolio: DEFAULT_PROFILE.portfolio,
            resume_tracks: DEFAULT_PROFILE.resumeTracks,
            preferences: DEFAULT_PROFILE.preferences
          };
          const { data: created, error: createError } = await supabase.from('profiles').insert(initial).select().single();
          if (createError) throw createError;
          profileData = created;
        }

        const { data: appsData, error: appsError } = await supabase
          .from('applications')
          .select('*')
          .eq('user_id', session.user.id)
          .order('timestamp', { ascending: false });

        if (appsError) throw appsError;

        setState({
          profile: {
            fullName: profileData.full_name,
            email: profileData.email,
            phone: profileData.phone,
            linkedin: profileData.linkedin,
            portfolio: profileData.portfolio,
            resumeTracks: profileData.resume_tracks,
            preferences: profileData.preferences
          },
          applications: (appsData || []).map((app: any) => ({
            id: app.id,
            jobId: app.job_id,
            jobTitle: app.job_title,
            company: app.company,
            status: app.status as ApplicationStatus,
            timestamp: app.timestamp,
            url: app.url,
            platform: app.platform,
            location: app.location,
            coverLetter: app.cover_letter,
            coverLetterStyle: app.cover_letter_style,
            mutatedResume: app.mutated_resume,
            mutationReport: app.mutation_report,
            verification: app.verification
          })),
          activeStrategy: null
        });
        setError(null);
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(`Cloud Sync Error: ${err.message || JSON.stringify(err)}`);
      }
    };

    fetchCloudData();
  }, [session]);

  const handleUpdateProfile = async (newProfile: UserProfile) => {
    if (!session?.user) return;
    setState(prev => ({ ...prev, profile: newProfile }));
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        full_name: newProfile.fullName,
        email: newProfile.email,
        phone: newProfile.phone,
        linkedin: newProfile.linkedin,
        portfolio: newProfile.portfolio,
        resume_tracks: newProfile.resumeTracks,
        preferences: newProfile.preferences,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Profile update error:", err);
      setError(`Profile Sync Failed: ${err.message || JSON.stringify(err)}`);
    }
  };

  const handleNewApplication = async (log: ApplicationLog) => {
    if (!session?.user) return;
    try {
      const payload = {
        user_id: session.user.id,
        job_id: log.jobId || `jid-${Date.now()}`,
        job_title: log.jobTitle,
        company: log.company,
        status: log.status,
        url: log.url,
        platform: log.platform || 'Other',
        location: log.location || 'Remote',
        cover_letter: log.coverLetter,
        cover_letter_style: log.coverLetterStyle,
        mutated_resume: log.mutatedResume,
        mutation_report: log.mutationReport,
        verification: log.verification || null
      };

      const { data: savedApp, error: insertError } = await supabase
        .from('applications')
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;
      
      if (savedApp) {
        setState(prev => ({
          ...prev,
          applications: [ { ...log, id: savedApp.id }, ...prev.applications ]
        }));
      }
    } catch (err: any) {
      console.error("Database Error:", err);
      setError(`Database Error: ${err.message || JSON.stringify(err)}`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setState({ profile: null, applications: [], activeStrategy: null });
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
      <div className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Cloud Identity Initializing...</div>
    </div>
  );

  if (!session) return <Auth />;

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout}>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-2 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase text-red-800 tracking-tight">System Alert</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p className="text-xs font-mono text-red-700 break-all bg-white/50 p-2 rounded border border-red-200">{error}</p>
          <div className="flex gap-4 mt-1">
            <button onClick={() => { setError(null); window.location.reload(); }} className="text-[10px] font-black text-red-600 uppercase hover:underline tracking-widest">Force Sync</button>
          </div>
        </div>
      )}
      
      {(!state.profile && !error) ? (
        <div className="p-20 text-center font-bold text-slate-300 animate-pulse uppercase tracking-widest text-xs">Synchronizing Identity Engine...</div>
      ) : (
        <>
          {activeTab === 'profile' && state.profile && <ProfileEditor profile={state.profile} onSave={handleUpdateProfile} />}
          {activeTab === 'history' && <ApplicationTracker applications={state.applications} profile={state.profile} />}
          {activeTab === 'discover' && state.profile && (
            <JobHunter 
              profile={state.profile} 
              activeStrategy={state.activeStrategy}
              onApply={handleNewApplication} 
              onStrategyUpdate={(p) => setState(prev => ({ ...prev, activeStrategy: p }))}
              onProfileUpdate={handleUpdateProfile}
            />
          )}
        </>
      )}
    </Layout>
  );
};

export default App;
