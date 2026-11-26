/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// Twelve weeks of demo measures for Insights. Every series measures intents
// moving through the system (how long they waited, what they cost, where a
// person was needed), never the people on them.

import type { Intent, Kind, Phase } from "../types";

/** Mondays, oldest first: 7 Sep → 23 Nov 2026. */
export const WEEKS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 7 + i * 7));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
});

/** Intents whose outcome was confirmed, per week, by criticality. */
export const THROUGHPUT: Record<Kind, number[]> = {
  security: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1],
  "data-integrity": [0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1],
  feature: [2, 2, 3, 2, 3, 3, 4, 3, 3, 4, 4, 5],
  bug: [1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1],
};

export type LeadPart = "queued" | "working" | "waiting";
export const LEAD_PART_LABEL: Record<LeadPart, string> = {
  queued: "Queued for a slot",
  working: "Agents working",
  waiting: "Waiting on people",
};

/**
 * Median hours per phase over the 12 weeks. Operate excludes the 72h burn-in,
 * which is policy, not delay. Technical review rarely waits on people (walls
 * and net-new ADRs only); business review waits on a person by design.
 */
export const LEAD_TIME: { phase: Exclude<Phase, "done">; queued: number; working: number; waiting: number }[] = [
  { phase: "defining", queued: 2, working: 1.5, waiting: 6 },
  { phase: "planning", queued: 4, working: 3, waiting: 10 },
  { phase: "engineering", queued: 16, working: 26, waiting: 14 },
  { phase: "technical", queued: 3, working: 8, waiting: 2 },
  { phase: "business", queued: 2, working: 1, waiting: 16 },
  { phase: "operate", queued: 3, working: 3, waiting: 2 },
];

/** Median spend per intent, by phase (USD, model usage through the broker). */
export const COST_BY_PHASE: { phase: Exclude<Phase, "done">; usd: number }[] = [
  { phase: "defining", usd: 0.6 },
  { phase: "planning", usd: 1.9 },
  { phase: "engineering", usd: 9.4 },
  { phase: "technical", usd: 3.6 },
  { phase: "business", usd: 0.5 },
  { phase: "operate", usd: 0.8 },
];

/** Spend per intent shipped in the 12 weeks, by criticality (USD, all phases). n = intents shipped. */
export const COST_BY_KIND: { kind: Kind; median: number; p85: number; n: number }[] = [
  { kind: "security", median: 11.2, p85: 19.8, n: 8 },
  { kind: "data-integrity", median: 21.4, p85: 34.0, n: 7 },
  { kind: "feature", median: 18.9, p85: 31.5, n: 38 },
  { kind: "bug", median: 6.1, p85: 10.4, n: 15 },
];

/**
 * Share of intents in which an agent stopped to ask a person, by phase. Gates
 * excluded: business review's acceptance is a person by design, so only extra
 * questions count there.
 */
export const HIL_RATE: { phase: Exclude<Phase, "done">; rate: number; note?: string }[] = [
  { phase: "defining", rate: 0.41 },
  { phase: "planning", rate: 0.28, note: "includes ADR-change recommendations" },
  { phase: "engineering", rate: 0.31 },
  { phase: "technical", rate: 0.06, note: "walls and net-new ADRs only" },
  { phase: "business", rate: 0.03, note: "acceptance is a person by design" },
  { phase: "operate", rate: 0.07 },
];

// ───────────────────────────── findings ─────────────────────────────
//
// patchy ingests scanner alerts, accumulates them into findings (per
// repository, or per cloud resource, for up to an hour), and an investigation
// agent triages each one: dismissed as a false positive, handed to people for
// manual remediation, or remediated, which in ktiro means a security intent.

export type FindingSource = "github-code-scanning" | "wiz" | "google-scc" | "generic";
export const FINDING_SOURCE_LABEL: Record<FindingSource, string> = {
  "github-code-scanning": "GitHub code scanning",
  wiz: "Wiz",
  "google-scc": "Google SCC",
  generic: "Generic",
};

/** The 12 weeks, per source: alerts in, findings after accumulation, and how investigation routed them. */
export const FINDINGS: { source: FindingSource; alerts: number; findings: number; dismissed: number; manual: number; intents: number }[] = [
  { source: "github-code-scanning", alerts: 236, findings: 47, dismissed: 38, manual: 4, intents: 5 },
  { source: "wiz", alerts: 88, findings: 19, dismissed: 14, manual: 3, intents: 2 },
  { source: "google-scc", alerts: 21, findings: 9, dismissed: 6, manual: 1, intents: 2 },
  { source: "generic", alerts: 17, findings: 5, dismissed: 3, manual: 1, intents: 1 },
];

/** Finding opened → security intent done (flag at 100% and removed), median days. */
export const FINDING_MTTR_DAYS = 4.1;
/** Feature intents, same measure, for contrast. */
export const FEATURE_LEAD_DAYS = 9.6;
/** Median cost per remediated finding: patchy's investigation plus the ktiro intent. */
export const FINDING_COST = { investigation: 0.9, intent: 11.2 };

/** Share of gates the agent skipped (high p(success), low impact), per week. */
export const AUTO_SKIP = [0.38, 0.41, 0.4, 0.44, 0.47, 0.46, 0.5, 0.53, 0.52, 0.56, 0.58, 0.61];
/** Gates skipped per week, and how many of those were later rolled back ("regret"). */
export const SKIPPED_GATES = [8, 9, 10, 11, 12, 11, 13, 13, 12, 14, 14, 15];
export const REGRET = [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0];

/** ARR impact (£k) shipped per week: estimated at intent vs measured against control. */
export const VALUE_ESTIMATED = [42, 38, 61, 55, 49, 70, 58, 66, 72, 64, 81, 88];
export const VALUE_MEASURED = [36, 40, 52, 49, 51, 61, 55, 60, 69, 66, 74, 79];

/** Canary outcomes over the 12 weeks. */
export const CANARY = { promoted: 44, rolledBack: 3 };

/** Measured value for a done intent: the canary's reading when there is one, else a stable demo figure. */
export function measuredValue(i: Intent): number {
  if (i.canary?.valueObserved) return i.canary.valueObserved;
  const f = 0.78 + ((Number(i.id) * 37) % 30) / 100;
  return Math.round((i.value.amount * f) / 100) * 100;
}
