import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createLocalClient } from './localClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const authMode = (import.meta.env.VITE_AUTH_MODE as string | undefined)?.toLowerCase();

/** true = accounts and history are stored in this browser (no Supabase / internet needed). */
export const isLocalMode = authMode === 'local' || !supabaseUrl || !supabaseAnonKey;

export const supabase: SupabaseClient = isLocalMode
  ? (createLocalClient() as unknown as SupabaseClient)
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

export const supabaseHost = (() => {
  try {
    return new URL(supabaseUrl).host;
  } catch {
    return '';
  }
})();

/** Turns low-level network errors into an explanation the user can act on. */
export function friendlyAuthError(message: string | undefined | null): string | null {
  if (!message) return null;
  if (isLocalMode) return message;
  if (!supabaseUrl || !supabaseAnonKey || !supabaseHost) {
    return 'Supabase settings are missing. Put your .env file (with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) in the project root, then restart npm run dev.';
  }
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(message)) {
    return `Cannot reach the login server (${supabaseHost}). Check that your internet works, the Supabase project is not paused (supabase.com dashboard -> Restore project), and that your network or VPN is not blocking supabase.co.`;
  }
  return message;
}
