/**
 * PKCE-shaped state for the desktop sign-in flow.
 *
 * The desktop is the only OAuth client we ship, and the web side controls
 * the redirect (no third-party token exchange happens), so a strict OAuth
 * PKCE handshake is overkill. We do use S256 challenge + opaque state so
 * a hostile process can't forge a `robin://auth/callback` and convince the
 * desktop to exchange someone else's link code.
 */

const VERIFIER_BYTES = 48;

export interface PendingPkce {
  state: string;
  verifier: string;
  createdAt: number;
}

export async function generatePkce(): Promise<PendingPkce> {
  const verifier = randomUrlSafe(VERIFIER_BYTES);
  const state = randomUrlSafe(16);
  return { state, verifier, createdAt: Date.now() };
}

export async function challengeFor(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function randomUrlSafe(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
