/**
 * Robin.dev desktop client — Clerk-protected handoff page.
 *
 * The desktop app opens the system browser at `/sign-in?redirect_url=/auth/desktop-handoff?…`.
 * Clerk handles the sign-in and lands the user here, with the PKCE-shaped
 * params (`state`, `code_challenge`) preserved in the query string.
 *
 * We mint a one-time link code bound to the signed-in user, then redirect
 * to `robin://auth/callback?state=<>&code=<>`. macOS routes the URL to the
 * Tauri app via the registered URL scheme.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { getWorkspaceForUser } from '@/lib/db/workspace';
import { mintLinkCode } from '@/lib/auth/desktop-session';

interface DesktopHandoffPageProps {
  searchParams: Promise<{
    state?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    redirect_scheme?: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function DesktopHandoffPage({ searchParams }: DesktopHandoffPageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in?redirect_url=/auth/desktop-handoff');
  }

  const params = await searchParams;
  const state = params.state;
  const codeChallenge = params.code_challenge;
  const method = params.code_challenge_method ?? 'S256';
  const scheme = params.redirect_scheme ?? 'robin';

  if (!state || !codeChallenge) {
    return (
      <ErrorShell
        title="Bad request"
        body="The desktop handoff is missing the state or code_challenge param. Reopen the desktop app and try again."
      />
    );
  }
  if (method !== 'S256') {
    return (
      <ErrorShell
        title="Unsupported PKCE method"
        body={`This page accepts S256 only — received ${method}.`}
      />
    );
  }

  const workspace = await getWorkspaceForUser(userId);
  const code = await mintLinkCode({
    userId,
    state,
    codeChallenge,
    workspaceId: workspace?.id ?? null,
  });

  // Build the deeplink URL and bounce. We use a meta-refresh fallback so the
  // user sees a clear "Returning to Robin…" screen even if the browser
  // intercepts the immediate redirect.
  const target = `${scheme}://auth/callback?state=${encodeURIComponent(
    state,
  )}&code=${encodeURIComponent(code)}`;

  return (
    <html lang="en">
      <head>
        <meta httpEquiv="refresh" content={`0;url=${target}`} />
        <title>Returning to Robin…</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#f4f1e9',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          color: '#1a1612',
        }}
      >
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Returning to Robin…</h1>
          <p style={{ color: '#7a7263', margin: 0 }}>
            You can close this tab once the app shows you the inbox.
          </p>
          <a href={target} style={{ display: 'inline-block', marginTop: 16, color: '#d63916' }}>
            Click here if Robin doesn&rsquo;t open automatically.
          </a>
        </div>
      </body>
    </html>
  );
}

function ErrorShell({ title, body }: { title: string; body: string }) {
  return (
    <main
      style={{
        margin: 0,
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#f4f1e9',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        color: '#1a1612',
      }}
    >
      <div style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>{title}</h1>
        <p style={{ color: '#7a7263', margin: 0 }}>{body}</p>
      </div>
    </main>
  );
}
