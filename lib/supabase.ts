
import { createClient } from '@supabase/supabase-js';

// Accessing window.process to prevent ReferenceError in "no-build" environments
const env = (window as any).process?.env || {};

const supabaseUrl = env.SUPABASE_URL || 'https://mkwuyxigbnyrkcwvfgjq.supabase.co';
const supabaseAnonKey = env.SUPABASE_ANON_KEY || 'sb_publishable_VDrYtNeRIrz1NMp87QAWXA_2LzlC2o-';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("CRITICAL: Supabase credentials missing from environment.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
