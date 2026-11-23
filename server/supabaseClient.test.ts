import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectServiceRoleKey } from './supabaseClient.ts';

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

test('inspectServiceRoleKey detects missing, anon/publishable, and service_role keys', () => {
  const original = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.deepEqual(inspectServiceRoleKey(), {
      configured: false,
      isPublicAnonKey: false,
      detectedRole: null
    });

    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_publishable_example123';
    assert.deepEqual(inspectServiceRoleKey(), {
      configured: true,
      isPublicAnonKey: true,
      detectedRole: 'publishable'
    });

    process.env.SUPABASE_SERVICE_ROLE_KEY = makeFakeJwt({ role: 'anon' });
    assert.deepEqual(inspectServiceRoleKey(), {
      configured: true,
      isPublicAnonKey: true,
      detectedRole: 'anon'
    });

    process.env.SUPABASE_SERVICE_ROLE_KEY = makeFakeJwt({ role: 'service_role' });
    assert.deepEqual(inspectServiceRoleKey(), {
      configured: true,
      isPublicAnonKey: false,
      detectedRole: 'service_role'
    });

    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_example123';
    assert.deepEqual(inspectServiceRoleKey(), {
      configured: true,
      isPublicAnonKey: false,
      detectedRole: 'service_role'
    });
  } finally {
    if (original === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = original;
    }
  }
});
