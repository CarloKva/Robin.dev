/**
 * Robin.dev — desktop download page.
 *
 * Self-contained marketing page. Fetches the current Tauri updater manifest
 * at runtime so the CTA always points at the latest signed DMG without
 * redeploying the web app.
 */

import { headers } from 'next/headers';

const MANIFEST_URL =
  process.env['NEXT_PUBLIC_DESKTOP_MANIFEST_URL'] ?? 'https://downloads.robin.dev/desktop/manifest.json';

interface UpdaterManifest {
  version: string;
  notes?: string;
  pub_date?: string;
  platforms?: Record<string, { url: string; signature?: string }>;
}

interface ResolvedDownload {
  version: string;
  url: string;
  publishedAt: string | null;
  notes: string | null;
}

async function resolveDownload(): Promise<ResolvedDownload | null> {
  try {
    const res = await fetch(MANIFEST_URL, {
      next: { revalidate: 300 }, // 5 minutes
    });
    if (!res.ok) return null;
    const manifest = (await res.json()) as UpdaterManifest;
    const platform =
      manifest.platforms?.['darwin-aarch64'] ??
      manifest.platforms?.['darwin-x86_64'] ??
      Object.values(manifest.platforms ?? {})[0];
    if (!platform?.url) return null;
    return {
      version: manifest.version,
      url: platform.url.replace(/\.app\.tar\.gz$/, '.dmg'),
      publishedAt: manifest.pub_date ?? null,
      notes: manifest.notes ?? null,
    };
  } catch {
    return null;
  }
}

export default async function DesktopDownloadPage() {
  const h = await headers();
  const ua = h.get('user-agent') ?? '';
  const isMac = /Macintosh|Mac OS X/i.test(ua);
  const download = await resolveDownload();

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '48px 24px',
        background: '#f4f1e9',
        color: '#1a1612',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Geist", system-ui, sans-serif',
      }}
    >
      <article style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
        <p
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: 999,
            background: '#fbe2d6',
            color: '#bd2f10',
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          New
        </p>
        <h1 style={{ fontSize: 36, fontWeight: 600, margin: '0 0 16px' }}>
          Robin in your menu bar.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.5, color: '#4d463c', margin: '0 0 28px' }}>
          Watch your engineers ship, read their letters, and reply without leaving the keyboard.
          macOS 11 and up.
        </p>

        {download ? (
          <a
            href={download.url}
            download
            style={{
              display: 'inline-block',
              padding: '12px 22px',
              background: '#d63916',
              color: '#fff7f3',
              fontSize: 15,
              fontWeight: 500,
              borderRadius: 12,
              textDecoration: 'none',
            }}
          >
            Download Robin {download.version}
            {!isMac ? ' for macOS' : ''}
          </a>
        ) : (
          <a
            href="https://github.com/CarloKva/Robin.dev/releases?q=desktop"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-block',
              padding: '12px 22px',
              background: '#1a1612',
              color: '#fcfaf5',
              fontSize: 15,
              fontWeight: 500,
              borderRadius: 12,
              textDecoration: 'none',
            }}
          >
            Latest builds on GitHub
          </a>
        )}

        {!isMac ? (
          <p style={{ marginTop: 18, fontSize: 13, color: '#7a7263' }}>
            Looks like you&rsquo;re not on a Mac — the desktop client is macOS only for now.
          </p>
        ) : null}
        {download?.publishedAt ? (
          <p style={{ marginTop: 28, fontSize: 12, color: '#7a7263' }}>
            Released {formatDate(download.publishedAt)}
            {download.notes ? ` — ${download.notes}` : ''}
          </p>
        ) : null}

        <p style={{ marginTop: 48, fontSize: 12, color: '#7a7263' }}>
          Signed with Apple Developer ID, notarised by Apple. Auto-updates from your menu bar.
        </p>
      </article>
    </main>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}
