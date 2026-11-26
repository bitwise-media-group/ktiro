/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// Development server for the prototype: Bun's bundler serves index.html with
// hot reload. Everything runs on the in-memory demo data in src/data, so there
// is nothing to forward.
//
//   bun run dev -- --port 5173
//
// Tailwind is applied through bunfig.toml ([serve.static] plugins), which is
// how the HTML dev server loads bundler plugins.

import { parseArgs } from "node:util";
import index from "./index.html";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: { port: { type: "string", default: "5173" } },
});

const server = Bun.serve({
  port: Number(values.port),
  development: { hmr: true, console: true },
  routes: { "/": index },
  fetch: () => new Response("Not found\n", { status: 404 }),
});

console.log(`ktiro prototype on ${server.url}`);
