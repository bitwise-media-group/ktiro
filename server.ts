/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// The production server: one self-contained page (dist/index.html, from
// build.ts) and two probes. The Dockerfile compiles this into a single
// binary (bun build --compile) on distroless; locally, `bun run start` serves
// the last build.
//
//   GET /            the prototype (gzip when accepted, ETag, no-cache)
//   GET /_/healthz   liveness and the load balancer's health check
//   GET /_/version   {"version", "commit"} of the running build
//
// Everything is in memory: the page is read and compressed once at start-up,
// so the server needs no writable filesystem. The page routes by hash, so no
// other path exists.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const port = Number(process.env.PORT ?? 8080);
const pagePath = process.env.KTIRO_PAGE ?? new URL("./dist/index.html", import.meta.url).pathname;
const version = process.env.KTIRO_VERSION ?? "dev";
const commit = process.env.KTIRO_COMMIT ?? "unknown";

const html = readFileSync(pagePath);
const gzipped = Bun.gzipSync(html, { level: 9 });
const etag = `"${createHash("sha256").update(html).digest("base64url").slice(0, 27)}"`;

// The page inlines its script and styles (the single-file build) and loads
// Atkinson Hyperlegible from Google Fonts; nothing else leaves the origin.
const SECURITY_HEADERS = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; "),
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "cross-origin-opener-policy": "same-origin",
  // A demo on demo data: keep it out of search results.
  "x-robots-tag": "noindex, nofollow",
};

function page(req: Request): Response {
  const headers: Record<string, string> = {
    ...SECURITY_HEADERS,
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-cache",
    etag,
    vary: "accept-encoding",
  };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  const gzip = /\bgzip\b/.test(req.headers.get("accept-encoding") ?? "");
  if (gzip) headers["content-encoding"] = "gzip";
  return new Response(req.method === "HEAD" ? null : gzip ? gzipped : html, { headers });
}

const server = Bun.serve({
  port,
  routes: {
    "/_/healthz": new Response("ok\n", { headers: { "content-type": "text/plain", "cache-control": "no-store" } }),
    "/_/version": Response.json({ version, commit }, { headers: { "cache-control": "no-store" } }),
  },
  fetch(req) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("method not allowed\n", { status: 405, headers: { allow: "GET, HEAD" } });
    }
    const { pathname } = new URL(req.url);
    if (pathname === "/" || pathname === "/index.html") return page(req);
    return new Response("not found\n", { status: 404, headers: { "content-type": "text/plain", ...SECURITY_HEADERS } });
  },
});

console.log(`ktiro ${version} (${commit.slice(0, 7)}) serving ${pagePath} on :${server.port}`);

// Kubernetes sends SIGTERM and waits: finish in-flight requests, then exit.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, async () => {
    await server.stop();
    process.exit(0);
  });
}
