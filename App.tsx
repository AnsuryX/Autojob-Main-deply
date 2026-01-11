
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import ProfileEditor from './components/ProfileEditor.tsx';
import JobHunter from './components/JobHunter.tsx';
import ApplicationTracker from './components/ApplicationTracker.tsx';
import Auth from './components/Auth.tsx';
import { AppState, ApplicationLog, UserProfile, ApplicationStatus } from './types.ts';
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
        setError(`Auth system offline: ${err.message}`);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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
            resume_tracks: DEFAULT_PROFILE.resumeTracks,
            preferences: DEFAULT_PROFILE.preferences
          };
          const { data: created, error: ce } = await supabase.from('profiles').insert(initial).select().single();
          if (ce) throw ce;
          profileData = created;
        }

        const { data: appsData, error: appsError } = await supabase
          .from('applications')
          .select('*')
          .eq('user_id', session.user.id)
          .order('timestamp', { ascending: false });

        if (appsError) {
          // If the error is about missing columns, we'll just log empty apps but alert the user
          if (appsError.code === 'PGRST204') {
            console.warn("Database columns missing. Use SQL editor.");
          } else {
            throw appsError;
          }
        }

        setState({
          profile: {
            fullName: profileData.full_name,
            email: profileData.email,
            phone: profileData.phone || "",
            linkedin: profileData.linkedin || "",
            portfolio: profileData.portfolio || "",
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
            platform: app.platform || 'Other',
            location: app.location || 'Remote',
            coverLetter: app.cover_letter,
            mutatedResume: app.mutated_resume,
            mutationReport: app.mutation_report,
            verification: app.verification
          })),
          activeStrategy: null
        });
      } catch (err: any) {
        setError(`Sync Error: ${err.message || JSON.stringify(err)}`);
      }
    };

    fetchCloudData();
  }, [session]);

  const handleUpdateProfile = async (newProfile: UserProfile) => {
    if (!session?.user) return;
    setState(prev => ({ ...prev, profile: newProfile }));
    try {
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
    } catch (err: any) {
      setError(`Profile Update Failed: ${err.message}`);
    }
  };

  const handleNewApplication = async (log: ApplicationLog) => {
    if (!session?.user) return;
    try {
      const payload = {
        user_id: session.user.id,
        job_id: log.jobId,
        job_title: log.jobTitle,
        company: log.company,
        status: log.status,
        url: log.url,
        // Using fallbacks to prevent insert errors if columns don't exist yet
        platform: log.platform || 'Other',
        location: log.location || 'Remote',
        cover_letter: log.coverLetter,
        mutated_resume: log.mutatedResume,
        mutation_report: log.mutationReport,
        verification: log.verification || null
      };

      const { data, error } = await supabase.from('applications').insert(payload).select().single();
      if (error) {
        // If PGRST204, columns are missing. Save locally but show warning.
        if (error.code === 'PGRST204') {
          console.error("Columns 'location' and 'platform' missing from DB. Run the SQL script.");
          setState(prev => ({ ...prev, applications: [log, ...prev.applications] }));
          return;
        }
        throw error;
      }
      
      setState(prev => ({ ...prev, applications: [ { ...log, id: data.id }, ...prev.applications ] }));
    } catch (err: any) {
      setError(`Database Error: ${err.message || JSON.stringify(err)}`);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-slate-300">Initializing...</div>;
  if (!session) return <Auth />;

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} onLogout={() => supabase.auth.signOut()}>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-2">
          <p className="text-[10px] font-black text-red-800 uppercase">Database Warning</p>
          <p className="text-xs font-mono text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-[10px] font-bold text-red-500 uppercase hover:underline text-left">Dismiss</button>
        </div>
      )}
      
      {state.profile ? (
        <>
          {activeTab === 'profile' && <ProfileEditor profile={state.profile} onSave={handleUpdateProfile} />}
          {activeTab === 'history' && <ApplicationTracker applications={state.applications} profile={state.profile} />}
          {activeTab === 'discover' && (
            <JobHunter 
              profile={state.profile} 
              activeStrategy={state.activeStrategy}
              onApply={handleNewApplication} 
              onStrategyUpdate={(p) => setState(prev => ({ ...prev, activeStrategy: p }))}
              onProfileUpdate={handleUpdateProfile}
            />
          )}
        </>
      ) : <div className="p-20 text-center font-bold text-slate-300">Loading Profile...</div>}
    </Layout>
  );
};

export default App;
