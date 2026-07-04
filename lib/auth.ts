/**
 * lib/auth.ts
 * ----------------------------------------------------------------------------
 * Session authentication for protected API routes (the AI tutor).
 *
 * SECURITY MODEL: /api/chat is gated — only a logged-in student may call it.
 * This module verifies the session from an HTTP-only cookie and returns the
 * authenticated user id, or null.
 *
 * INTEGRATION: this is written against a signed-JWT session cookie because the
 * shipped app has no server auth yet. If you already use NextAuth / Clerk /
 * Supabase Auth, replace the body of getSessionUser() with that provider's
 * server-side session read (e.g. `auth()` / `getServerSession()` /
 * `supabase.auth.getUser()`). The route only depends on the return shape.
 */
import { NextRequest } from 'next/server';
import crypto from 'node:crypto';

export interface SessionUser {
  id: string;
  email?: string;
}

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'kw_session';
const SECRET = process.env.SESSION_SECRET || '';

/** Verify a compact HS256 JWT (header.payload.signature) signed with SESSION_SECRET. */
function verifyJwt(token: string): SessionUser | null {
  if (!SECRET) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;

  const expected = crypto
    .createHmac('sha256', SECRET)
    .update(`${h}.${p}`)
    .digest('base64url');

  // constant-time compare to avoid signature timing attacks
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: any;
  try { payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')); }
  catch { return null; }

  if (payload.exp && Date.now() / 1000 > payload.exp) return null; // expired
  const id = payload.sub || payload.uid || payload.id;
  if (!id) return null;
  return { id: String(id), email: payload.email };
}

/**
 * Returns the authenticated user, or null if the request has no valid session.
 * Reads the session from an HTTP-only cookie (not from any client-supplied
 * body/header that could be spoofed).
 */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyJwt(token);
}
