
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  
  // Static development password for "passwordless" bypass
  const DEV_BYPASS_PASSWORD = 'AutoJobDevBypass2025!';

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    setMessage('Authenticating secure session...');

    try {
      // 1. Attempt Sign In
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ 
        email, 
        password: DEV_BYPASS_PASSWORD 
      });

      if (signInError) {
        // 2. If user doesn't exist, attempt Sign Up
        if (signInError.message.includes('Invalid login credentials')) {
          setMessage('Creating new developer profile...');
          const { error: signUpError } = await supabase.auth.signUp({ 
            email, 
            password: DEV_BYPASS_PASSWORD 
          });
          
          if (signUpError) throw signUpError;
          
          // 3. Sign in immediately after signup
          const { error: finalSignInError } = await supabase.auth.signInWithPassword({ 
            email, 
            password: DEV_BYPASS_PASSWORD 
          });
          if (finalSignInError) throw finalSignInError;
        } else {
          throw signInError;
        }
      }
    } catch (error: any) {
      setMessage(error.message || 'An error occurred during bypass authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto shadow-lg">A</div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AutoJob Cloud</h1>
          <div className="flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Development Bypass Active</p>
          </div>
          <p className="text-slate-500 text-sm pt-2">
            Enter your email to access your autonomous workspace.
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Identity</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all text-lg"
              placeholder="your-email@example.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Connecting...
              </>
            ) : (
              'Enter Workspace'
            )}
          </button>
        </form>

        {message && (
          <div className={`p-4 rounded-xl text-[10px] font-bold text-center uppercase tracking-wider ${
            message.includes('Creating') || message.includes('Authenticating')
            ? 'bg-indigo-50 text-indigo-600' 
            : 'bg-red-50 text-red-600'
          }`}>
            {message}
          </div>
        )}

        <div className="pt-6 border-t border-slate-100 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
             <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"/></svg>
             Cloud Persistence Mode
          </div>
          <p className="text-[9px] text-slate-300 text-center px-4">
            Security notice: Passwords are automatically managed for the MVP preview. Your data is isolated to your email identity.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
