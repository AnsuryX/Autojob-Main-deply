
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mkwuyxigbnyrkcwvfgjq.supabase.co';
const supabaseAnonKey = 'sb_publishable_VDrYtNeRIrz1NMp87QAWXA_2LzlC2o-';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
