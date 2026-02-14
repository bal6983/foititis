import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load from packages/cli/.env
loadEnv({ path: resolve(__dirname, '../../.env') });

export function getConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
        'Create packages/cli/.env with:\n\n' +
        '  SUPABASE_URL=https://your-project.supabase.co/\n' +
        '  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key\n'
    );
    process.exit(1);
  }

  return { supabaseUrl, serviceRoleKey };
}

export function getAnonKey(): string {
  const webEnvPath = resolve(__dirname, '../../../../apps/web/.env.local');
  try {
    const content = readFileSync(webEnvPath, 'utf-8');
    const match = content.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
    if (match?.[1]) return match[1].trim();
  } catch {
    // ignore
  }
  console.error('Could not read VITE_SUPABASE_ANON_KEY from apps/web/.env.local');
  process.exit(1);
}
