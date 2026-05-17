import { createClient } from '@supabase/supabase-js';

// Fallback to empty strings to prevent crash if env vars are missing during dev
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
