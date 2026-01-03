
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

  // Handle Auth Session
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      })
      .catch(err => {
        console.error("Supabase Session Error:", err);
        setError("Network Error: Could not establish a connection to the database.");
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setError(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Cloud Data
  useEffect(() => {
    if (!session?.user) return;

    const fetchCloudData = async () => {
      try {
        // 1. Fetch Profile
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

        // 2. Fetch Applications
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
            mutationReport: app.mutation_report
          })),
          activeStrategy: null
        });
        setError(null);
      } catch (err: any) {
        console.error("Cloud Sync Error:", err);
        setError(`Cloud Sync Failed: ${err.message || 'Check your internet connection.'}`);
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
    } catch (err) {
      console.error("Profile update failed:", err);
    }
  };

  const handleNewApplication = async (log: ApplicationLog) => {
    if (!session?.user) return;
    try {
      const { data: savedApp, error } = await supabase.from('applications').insert({
        user_id: session.user.id,
        job_id: log.jobId,
        job_title: log.jobTitle,
        company: log.company,
        status: log.status,
        url: log.url,
        platform: log.platform,
        location: log.location,
        cover_letter: log.coverLetter,
        cover_letter_style: log.coverLetterStyle,
        mutated_resume: log.mutatedResume,
        mutation_report: log.mutationReport
      }).select().single();

      if (error) throw error;
      if (savedApp) {
        setState(prev => ({
          ...prev,
          applications: [...prev.applications, { ...log, id: savedApp.id }]
        }));
      }
    } catch (err) {
      console.error("Application save failed:", err);
    }
  };

  const handleStrategyUpdate = (plan: StrategyPlan | null) => {
    setState(prev => ({ ...prev, activeStrategy: plan }));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setState({ profile: null, applications: [], activeStrategy: null });
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
      <div className="font-bold text-slate-400 animate-pulse uppercase tracking-widest text-xs">Initializing Secure Workspace...</div>
    </div>
  );

  if (!session) return <Auth />;

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout}>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <p className="text-sm font-semibold text-red-800">{error}</p>
          </div>
          <button onClick={() => window.location.reload()} className="text-xs font-bold text-red-600 uppercase hover:underline">Retry</button>
        </div>
      )}
      
      {(!state.profile && !error) ? (
        <div className="p-20 text-center font-bold text-slate-400">Synchronizing Identity...</div>
      ) : (
        <>
          {activeTab === 'profile' && state.profile && <ProfileEditor profile={state.profile} onSave={handleUpdateProfile} />}
          {activeTab === 'history' && <ApplicationTracker applications={state.applications} profile={state.profile} />}
          {activeTab === 'discover' && state.profile && (
            <JobHunter 
              profile={state.profile} 
              activeStrategy={state.activeStrategy}
              onApply={handleNewApplication} 
              onStrategyUpdate={handleStrategyUpdate}
              onProfileUpdate={handleUpdateProfile}
            />
          )}
        </>
      )}
    </Layout>
  );
};

export default App;
