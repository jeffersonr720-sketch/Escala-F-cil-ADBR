import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let cachedSignature = '';

function normalizeEnvValue(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '').trim();
  if (
    !trimmed ||
    trimmed.startsWith('MY_SUPABASE') ||
    trimmed.startsWith('YOUR_SUPABASE') ||
    trimmed.includes('your-project.supabase.co')
  ) {
    return '';
  }
  return trimmed;
}

export function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  const cleaned = normalizeEnvValue(rawUrl);
  if (!cleaned || !/^https?:\/\//i.test(cleaned)) return '';
  try {
    return new URL(cleaned).origin;
  } catch {
    return '';
  }
}

export function getSupabaseCredentials(): { url: string; key: string } | null {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const serviceKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey = normalizeEnvValue(process.env.SUPABASE_ANON_KEY);
  const key = serviceKey || anonKey;

  if (!url || !key) return null;

  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseCredentials() !== null;
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export interface ServiceRoleInspection {
  configured: boolean;
  isPublicAnonKey: boolean;
  detectedRole: string | null;
}

export function inspectServiceRoleKey(rawKey?: string): ServiceRoleInspection {
  const key = normalizeEnvValue(rawKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key) {
    return { configured: false, isPublicAnonKey: false, detectedRole: null };
  }
  if (key.startsWith('sb_publishable_')) {
    return { configured: true, isPublicAnonKey: true, detectedRole: 'publishable' };
  }
  if (key.startsWith('sb_secret_')) {
    return { configured: true, isPublicAnonKey: false, detectedRole: 'service_role' };
  }
  const parts = key.split('.');
  if (parts.length === 3 && parts[1]) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
        role?: unknown;
      };
      const role = typeof payload.role === 'string' ? payload.role : null;
      return {
        configured: true,
        isPublicAnonKey: role === 'anon',
        detectedRole: role
      };
    } catch {
      return { configured: true, isPublicAnonKey: false, detectedRole: null };
    }
  }
  return { configured: true, isPublicAnonKey: false, detectedRole: null };
}

export function hydrateServiceRoleKeyFromDotEnv(envFilePath?: string): boolean {
  const current = inspectServiceRoleKey();
  if (current.configured && !current.isPublicAnonKey) {
    return false;
  }
  const resolvedPath = envFilePath ?? path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(resolvedPath)) {
    return false;
  }
  try {
    const parsed = dotenv.parse(fs.readFileSync(resolvedPath, 'utf8'));
    const candidate = normalizeEnvValue(parsed.SUPABASE_SERVICE_ROLE_KEY);
    if (!candidate) return false;
    const candidateInfo = inspectServiceRoleKey(candidate);
    if (!candidateInfo.configured || candidateInfo.isPublicAnonKey) {
      return false;
    }
    process.env.SUPABASE_SERVICE_ROLE_KEY = candidate;
    cachedClient = null;
    cachedSignature = '';
    return true;
  } catch {
    return false;
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  const creds = getSupabaseCredentials();
  if (!creds) {
    cachedClient = null;
    cachedSignature = '';
    return null;
  }

  const signature = `${creds.url}::${creds.key}`;
  if (cachedClient && cachedSignature === signature) {
    return cachedClient;
  }

  cachedClient = createClient(creds.url, creds.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  cachedSignature = signature;
  return cachedClient;
}

export function isSupabaseTableMissingError(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  if (code === 'PGRST205' || code === '42P01') return true;
  const msg = String(error.message || '').toLowerCase();
  return (
    msg.includes('could not find the table') ||
    (msg.includes('relation') && msg.includes('does not exist')) ||
    msg.includes('schema cache')
  );
}

export function isSupabaseFallbackError(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false;
  if (isSupabaseTableMissingError(error)) return true;
  const code = String(error.code || '').toUpperCase();
  if (code === '42501' || code === 'PGRST301') return true;
  const msg = String(error.message || '').toLowerCase();
  return (
    msg.includes('row-level security') ||
    msg.includes('invalid api key') ||
    msg.includes('jwt') ||
    msg.includes('permission denied') ||
    msg.includes('unexpected token') ||
    msg.includes('fetch failed') ||
    msg.includes('enotfound') ||
    msg.includes('eai_again') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('network') ||
    msg.includes('und_err')
  );
}

