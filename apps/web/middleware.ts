import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  // KVA Room connector — uses own Bearer auth (not Clerk)
  "/api/connector/(.*)",
  "/api/auth/session",
  // Desktop client OAuth handshake — verified inside the handler via PKCE,
  // not via Clerk session cookie. See apps/desktop/src-tauri/src/auth.rs.
  "/api/auth/desktop-session",
  "/api/auth/desktop-session/refresh",
  "/api/auth/desktop-session/poll",
]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
