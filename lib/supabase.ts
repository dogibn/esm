import { createServerClient as supabaseCreateServerClient, createBrowserClient as supabaseCreateBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';

interface CookieOpts {
  path?: string;
  maxAge?: number;
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none' | boolean;
}

function serializeCookie(name: string, value: string, opts: CookieOpts): string {
  let s = `${name}=${value}`;
  if (opts.path != null) s += `; Path=${opts.path}`;
  if (opts.maxAge != null) s += `; Max-Age=${Math.floor(opts.maxAge)}`;
  if (opts.domain) s += `; Domain=${opts.domain}`;
  if (opts.expires) s += `; Expires=${opts.expires.toUTCString()}`;
  if (opts.httpOnly) s += `; HttpOnly`;
  if (opts.secure) s += `; Secure`;
  if (opts.sameSite) {
    if (opts.sameSite === true) {
      s += `; SameSite=Strict`;
    } else {
      const ss = opts.sameSite as string;
      s += `; SameSite=${ss.charAt(0).toUpperCase()}${ss.slice(1)}`;
    }
  }
  return s;
}

export function createServerClient(req: Request) {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const cookieMap = new Map<string, string>(
    cookieHeader
      .split(/;\s*/)
      .filter(Boolean)
      .flatMap((pair) => {
        const idx = pair.indexOf('=');
        if (idx === -1) return [];
        return [[pair.slice(0, idx), pair.slice(idx + 1)] as [string, string]];
      })
  );

  const pendingCookies: Array<{ name: string; value: string; options: CookieOpts }> = [];
  const pendingHeaders: Record<string, string> = {};

  const client = supabaseCreateServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet, headers) {
        for (const cookie of cookiesToSet) {
          pendingCookies.push(cookie as { name: string; value: string; options: CookieOpts });
        }
        Object.assign(pendingHeaders, headers);
      },
    },
  });

  function applyToHeaders(responseHeaders: Headers): void {
    for (const { name, value, options } of pendingCookies) {
      responseHeaders.append('Set-Cookie', serializeCookie(name, value, options));
    }
    for (const [key, val] of Object.entries(pendingHeaders)) {
      responseHeaders.set(key, val);
    }
  }

  return { client, applyToHeaders };
}

export function createBrowserClient() {
  return supabaseCreateBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
