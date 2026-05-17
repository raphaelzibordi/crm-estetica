import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured =
  Boolean(supabaseUrl) && Boolean(supabaseAnonKey) && supabaseUrl.startsWith('http');

if (!isSupabaseConfigured) {
  console.error(
    '[Lumina] Variáveis de ambiente do Supabase ausentes ou inválidas. ' +
      'Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.'
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'http://invalid.local',
  supabaseAnonKey || 'invalid-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'lumina.auth.session',
      flowType: 'pkce',
    },
    global: {
      headers: {
        'X-Client-Info': 'lumina-crm-web',
      },
    },
  }
);
