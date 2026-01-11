
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

        if (appsError && appsError.code !== 'PGRST204') throw appsError;

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
        setError(`Cloud Sync Issue: ${err.message || 'Check database schema'}`);
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
    
    // Optimistic Update
    setState(prev => ({ ...prev, applications: [log, ...prev.applications] }));

    try {
      const payload = {
        user_id: session.user.id,
        job_id: log.jobId,
        job_title: log.jobTitle,
        company: log.company,
        status: log.status,
        url: log.url,
        platform: log.platform || 'Other',
        location: log.location || 'Remote',
        cover_letter: log.coverLetter,
        mutated_resume: log.mutatedResume,
        mutation_report: log.mutationReport,
        verification: log.verification || null
      };

      const { data, error: insertError } = await supabase.from('applications').insert(payload).select().single();
      
      if (insertError) {
        if (insertError.code === 'PGRST204') {
          console.error("Column missing in 'applications' table. Data saved in memory only.");
          setError("Warning: Database schema outdated. Columns 'location' or 'platform' missing. Run SQL script.");
        } else {
          throw insertError;
        }
      } else if (data) {
        // Replace temporary log with DB log (to get correct ID)
        setState(prev => ({
          ...prev,
          applications: prev.applications.map(app => app.id === log.id ? { ...log, id: data.id } : app)
        }));
      }
    } catch (err: any) {
      console.error("Failed to sync application:", err);
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
       <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
          <p className="font-black text-slate-300 uppercase tracking-widest text-xs">Synchronizing Identity...</p>
       </div>
    </div>
  );
  
  if (!session) return <Auth />;

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} onLogout={() => supabase.auth.signOut()}>
      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex flex-col gap-2 shadow-sm animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Database Sync Alert</p>
            <button onClick={() => setError(null)} className="text-amber-500 hover:text-amber-700 font-bold">✕</button>
          </div>
          <p className="text-xs font-mono text-amber-700">{error}</p>
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
      ) : <div className="p-20 text-center font-black text-slate-200 uppercase tracking-widest">Building Agent...</div>}
    </Layout>
  );
};

export default App;
