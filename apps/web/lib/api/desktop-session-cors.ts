import { NextResponse } from 'next/server';

/** Tauri+Vite (:1420) → Next (:3000) is cross-origin; WebView applies CORS to fetch(). */
const DESKTOP_AUTH_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS, POST',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export function desktopAuthPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: DESKTOP_AUTH_CORS_HEADERS });
}

export function withDesktopAuthCors<T extends NextResponse>(response: T): T {
  for (const [key, value] of Object.entries(DESKTOP_AUTH_CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
