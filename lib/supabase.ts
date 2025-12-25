
import { createClient } from '@supabase/supabase-js';

// Using environment variables is standard practice for production hosting.
// Cloudflare Pages handles process.env injection during the build/edge-runtime.
const supabaseUrl = process.env.SUPABASE_URL || 'https://mkwuyxigbnyrkcwvfgjq.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_VDrYtNeRIrz1NMp87QAWXA_2LzlC2o-';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase configuration is incomplete. Authentication may fail.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
