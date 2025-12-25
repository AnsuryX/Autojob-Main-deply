
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'update'>('login');
  const [message, setMessage] = useState('');

  // Detect if user is returning from a password recovery link
  useEffect(() => {
    const handleRecovery = async () => {
      const hash = window.location.hash;
      if (hash && hash.includes('type=recovery')) {
        setMode('update');
        setMessage('Please enter your new password below.');
      }
    };
    handleRecovery();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email for the confirmation link!');
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage('Password reset link sent! Check your inbox.');
      } else if (mode === 'update') {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage('Password updated successfully! You can now log in.');
        setTimeout(() => setMode('login'), 2000);
      }
    } catch (error: any) {
      setMessage(error.message || 'An error occurred during authentication.');
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
          <p className="text-slate-500 text-sm">
            {mode === 'update' ? 'Secure your account with a new password.' : 'Persist your career tracks & hunt history.'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all"
                placeholder="name@company.com"
                required
              />
            </div>
          )}

          {(mode === 'login' || mode === 'signup' || mode === 'update') && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                {mode === 'update' ? 'New Password' : 'Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {mode === 'update' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {mode === 'login' && (
            <div className="flex justify-end px-1">
              <button
                type="button"
                onClick={() => setMode('reset')}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-500 uppercase tracking-widest"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 
             mode === 'login' ? 'Sign In' : 
             mode === 'signup' ? 'Create Account' : 
             mode === 'reset' ? 'Send Reset Link' : 'Update Password'}
          </button>
        </form>

        {message && (
          <div className={`p-4 rounded-xl text-xs font-bold text-center ${
            message.includes('Check') || message.includes('success') || mode === 'update' 
            ? 'bg-green-50 text-green-600' 
            : 'bg-red-50 text-red-600'
          }`}>
            {message}
          </div>
        )}

        <div className="text-center space-y-2">
          {mode !== 'update' && (
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-indigo-600 font-bold text-sm hover:underline block w-full"
            >
              {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
            </button>
          )}
          
          {mode === 'reset' && (
            <button
              onClick={() => setMode('login')}
              className="text-slate-400 font-bold text-xs hover:text-slate-600 block w-full uppercase tracking-tighter"
            >
              Back to Login
            </button>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
           <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"/></svg>
           Supabase Secure Persistence
        </div>
      </div>
    </div>
  );
};

export default Auth;
