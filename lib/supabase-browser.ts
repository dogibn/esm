import { createBrowserClient as supabaseCreateBrowserClient } from '@supabase/ssr';
import { clientEnv } from '@/lib/env-client';

export function createBrowserClient() {
  return supabaseCreateBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
