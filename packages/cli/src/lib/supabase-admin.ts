import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from './config.js';

let _client: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (!_client) {
    const { supabaseUrl, serviceRoleKey } = getConfig();
    _client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _client;
}

// Shortcut for backwards compat - lazy getter
export const adminClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getAdminClient() as Record<string | symbol, unknown>)[prop];
  },
});
