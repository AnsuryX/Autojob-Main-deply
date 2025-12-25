
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ProfileEditor from './components/ProfileEditor';
import JobHunter from './components/JobHunter';
import ApplicationTracker from './components/ApplicationTracker';
import Auth from './components/Auth';
import { AppState, ApplicationLog, UserProfile, StrategyPlan, ApplicationStatus } from './types';
import { DEFAULT_PROFILE } from './constants';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('discover');
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<AppState>({ 
    profile: null, 
    applications: [], 
    activeStrategy: null 
  });

  // Handle Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Cloud Data when session is active
  useEffect(() => {
    if (!session?.user) return;

    const fetchCloudData = async () => {
      // 1. Fetch Profile
      let { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profileData) {
        // Create initial profile if missing
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
        const { data: created } = await supabase.from('profiles').insert(initial).select().single();
        profileData = created;
      }

      // 2. Fetch Applications
      const { data: appsData } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('timestamp', { ascending: false });

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
          coverLetter: app.cover_letter,
          coverLetterStyle: app.cover_letter_style,
          mutatedResume: app.mutated_resume,
          mutationReport: app.mutation_report
        })),
        activeStrategy: null
      });
    };

    fetchCloudData();
  }, [session]);

  const handleUpdateProfile = async (newProfile: UserProfile) => {
    if (!session?.user) return;
    
    // Optimistic Update
    setState(prev => ({ ...prev, profile: newProfile }));

    // Cloud Update
    await supabase.from('profiles').upsert({
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
  };

  const handleNewApplication = async (log: ApplicationLog) => {
    if (!session?.user) return;

    // Cloud Save
    const { data: savedApp, error } = await supabase.from('applications').insert({
      user_id: session.user.id,
      job_id: log.jobId,
      job_title: log.jobTitle,
      company: log.company,
      status: log.status,
      url: log.url,
      cover_letter: log.coverLetter,
      cover_letter_style: log.coverLetterStyle,
      mutated_resume: log.mutatedResume,
      mutation_report: log.mutationReport
    }).select().single();

    if (!error && savedApp) {
      setState(prev => ({
        ...prev,
        applications: [...prev.applications, { ...log, id: savedApp.id }]
      }));
    }
  };

  const handleStrategyUpdate = (plan: StrategyPlan | null) => {
    setState(prev => ({ ...prev, activeStrategy: plan }));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setState({ profile: null, applications: [], activeStrategy: null });
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-slate-400 animate-pulse">Establishing Secure Connection...</div>;
  if (!session) return <Auth />;

  const renderContent = () => {
    if (!state.profile) return <div className="p-20 text-center font-bold text-slate-400">Loading Persona Configuration...</div>;

    switch (activeTab) {
      case 'profile':
        return <ProfileEditor profile={state.profile} onSave={handleUpdateProfile} />;
      case 'history':
        return <ApplicationTracker applications={state.applications} />;
      case 'discover':
      default:
        return (
          <JobHunter 
            profile={state.profile} 
            activeStrategy={state.activeStrategy}
            onApply={handleNewApplication} 
            onStrategyUpdate={handleStrategyUpdate}
          />
        );
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout}>
      {renderContent()}
    </Layout>
  );
};

export default App;
