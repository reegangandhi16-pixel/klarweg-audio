/**
 * lib/rate-limit.ts
 * ----------------------------------------------------------------------------
 * Distributed, production-ready rate limiting backed by Upstash Redis
 * (works on Vercel KV too — both speak the Upstash REST protocol).
 *
 * Two independent limits are enforced per request:
 *   • per-IP    — blunt anti-abuse, keyed on the platform's TRUSTED ip
 *   • per-user  — fair-use ceiling, keyed on the authenticated session id
 *
 * Fixed-window via an atomic INCR + EXPIRE (Lua) so it is correct across many
 * serverless instances. If Redis is unreachable we FAIL CLOSED for safety
 * (deny) rather than silently allowing unlimited spend — configurable.
 *
 * ENV:
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN   (or KV_REST_API_URL / KV_REST_API_TOKEN)
 *   RATE_LIMIT_IP_MAX        (default 30)  per IP per window
 *   RATE_LIMIT_USER_MAX      (default 20)  per user per window
 *   RATE_LIMIT_WINDOW_MS     (default 300000 = 5 min)
 *   RATE_LIMIT_FAIL_OPEN     ('true' to allow when Redis is down; default deny)
 */

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

const IP_MAX = Number(process.env.RATE_LIMIT_IP_MAX || 30);
const USER_MAX = Number(process.env.RATE_LIMIT_USER_MAX || 20);
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000);
const WINDOW_S = Math.ceil(WINDOW_MS / 1000);
const FAIL_OPEN = process.env.RATE_LIMIT_FAIL_OPEN === 'true';

export interface RateResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  scope: 'ip' | 'user';
  degraded?: boolean; // true when Redis was unreachable
}

/**
 * Atomic fixed-window counter: INCR the key, set EXPIRE on first hit.
 * Returns the post-increment count, or null if Redis is unreachable.
 */
async function incrWindow(key: string): Promise<number | null> {
  if (!REST_URL || !REST_TOKEN) return null;
  // Upstash pipeline: INCR then (EXPIRE NX). Two commands, one round-trip.
  try {
    const res = await fetch(`${REST_URL}/pipeline`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${REST_TOKEN}`,
        'content-type': 'application/json',
      },
      // EXPIRE ... NX only sets TTL if none exists → true fixed window.
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(WINDOW_S), 'NX'],
      ]),
      // keep the limiter fast; if Redis is slow we treat it as unreachable
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const out = (await res.json()) as Array<{ result: number }>;
    return typeof out?.[0]?.result === 'number' ? out[0].result : null;
  } catch {
    return null;
  }
}

async function limit(scope: 'ip' | 'user', id: string, max: number): Promise<RateResult> {
  const windowId = Math.floor(Date.now() / WINDOW_MS);
  const key = `rl:${scope}:${id}:${windowId}`;
  const resetAt = (windowId + 1) * WINDOW_MS;

  const count = await incrWindow(key);
  if (count === null) {
    // Redis down — fail closed by default (deny) so spend can't be abused.
    return { ok: FAIL_OPEN, remaining: 0, resetAt, limit: max, scope, degraded: true };
  }
  return { ok: count <= max, remaining: Math.max(0, max - count), resetAt, limit: max, scope };
}

/**
 * Enforce BOTH per-IP and per-user limits. Returns the first failing result,
 * or the per-user result when both pass (so headers reflect the tighter cap).
 */
export async function checkRateLimits(ip: string, userId: string): Promise<RateResult> {
  const [ipRes, userRes] = await Promise.all([
    limit('ip', ip, IP_MAX),
    limit('user', userId, USER_MAX),
  ]);
  if (!ipRes.ok) return ipRes;
  if (!userRes.ok) return userRes;
  return userRes;
}
