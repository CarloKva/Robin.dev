#!/usr/bin/env node
/**
 * Robin.dev — Test JWT Generator
 * docs/security/generate-test-jwt.mjs
 *
 * Genera JWT firmati con il secret Supabase per simulare due utenti
 * distinti nei test di isolamento RLS.
 *
 * Uso:
 *   SUPABASE_JWT_SECRET=<secret> node generate-test-jwt.mjs user_test_A
 *   SUPABASE_JWT_SECRET=<secret> node generate-test-jwt.mjs user_test_B
 *
 * Output: JWT da usare come Bearer token nei test curl
 *
 * Prerequisito: npm install jsonwebtoken
 */

import { createHmac } from "crypto";

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
if (!SUPABASE_JWT_SECRET) {
  console.error("Error: SUPABASE_JWT_SECRET env var is required");
  process.exit(1);
}

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: node generate-test-jwt.mjs <user_id>");
  console.error("Example: node generate-test-jwt.mjs user_test_A");
  process.exit(1);
}

// Build JWT manually (no external dep needed)
function base64url(data) {
  return Buffer.from(JSON.stringify(data))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

const header = { alg: "HS256", typ: "JWT" };
const now = Math.floor(Date.now() / 1000);
const payload = {
  sub: userId,
  iss: "https://clerk.test",
  aud: "authenticated",
  role: "authenticated",
  iat: now,
  exp: now + 3600,
};

const headerB64 = base64url(header);
const payloadB64 = base64url(payload);
const signingInput = `${headerB64}.${payloadB64}`;

const signature = createHmac("sha256", SUPABASE_JWT_SECRET)
  .update(signingInput)
  .digest("base64")
  .replace(/=/g, "")
  .replace(/\+/g, "-")
  .replace(/\//g, "_");

const token = `${signingInput}.${signature}`;
console.log(token);
