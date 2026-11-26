/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// Prioritisation: criticality first (set by agents), then value (the tenant's
// one metric), then human importance (the least significant input). A share
// of capacity is reserved for bugs, so they are never starved by features.

import { TENANT } from "./data/org";
import type { Importance, Intent, Kind, Phase } from "./types";

export const KIND_TIER: Record<Kind, number> = { security: 0, "data-integrity": 1, feature: 2, bug: 3 };
const IMPORTANCE_RANK: Record<Importance, number> = { high: 0, normal: 1, low: 2 };

export function compareIntents(a: Intent, b: Intent): number {
  return (
    KIND_TIER[a.kind] - KIND_TIER[b.kind] ||
    b.value.amount - a.value.amount ||
    IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance] ||
    a.createdAt - b.createdAt
  );
}

// Fast-path intents (removing a fully rolled-out flag) are tiny and change no
// behaviour, so they ride alongside the limits rather than taking a slot.
export const isActive = (i: Intent) => i.phase !== "done" && i.status !== "queued" && !i.fastPath;
export const inPhase = (intents: Intent[], phase: Phase) => intents.filter((i) => i.phase === phase);
export const activeIn = (intents: Intent[], phase: Phase) =>
  intents.filter((i) => i.phase === phase && i.status !== "queued" && !i.fastPath);
export const fastPathIn = (intents: Intent[], phase: Phase) => intents.filter((i) => i.phase === phase && i.fastPath);
export const queuedFor = (intents: Intent[], phase: Phase) =>
  intents.filter((i) => i.phase === phase && i.status === "queued").sort(compareIntents);

export const wipLimit = (phase: Phase) => TENANT.wip[phase] ?? Infinity;
export const hasSlot = (intents: Intent[], phase: Phase) => activeIn(intents, phase).length < wipLimit(phase);

/** Is a dependency still open? */
export const blockedBy = (intents: Intent[], i: Intent) =>
  i.dependsOn.filter((d) => intents.find((x) => x.id === d)?.phase !== "done");

/**
 * The next intent to pull into a phase. Bugs get the slot whenever bugs hold
 * less than their reserved share of everything in flight.
 */
export function nextToPull(intents: Intent[], phase: Phase): Intent | undefined {
  const waiting = queuedFor(intents, phase).filter((i) => blockedBy(intents, i).length === 0);
  if (waiting.length === 0) return undefined;
  const inFlight = intents.filter(isActive);
  const bugShare = inFlight.filter((i) => i.kind === "bug").length / Math.max(1, inFlight.length);
  const topBug = waiting.find((i) => i.kind === "bug");
  if (topBug && bugShare < TENANT.bugReserve && KIND_TIER[waiting[0].kind] >= KIND_TIER.feature) return topBug;
  return waiting[0];
}

export function bugReserveStatus(intents: Intent[]) {
  const inFlight = intents.filter(isActive);
  const bugs = inFlight.filter((i) => i.kind === "bug").length;
  return { bugs, total: inFlight.length, share: bugs / Math.max(1, inFlight.length), reserve: TENANT.bugReserve };
}

/** The whole backlog in pull order, for display. */
export function rankAll(intents: Intent[]): Intent[] {
  return intents.filter((i) => i.phase !== "done").sort(compareIntents);
}
