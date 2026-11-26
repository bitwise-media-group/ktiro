/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

import { KIND_LABEL, KIND_TONE, money } from "../format";
import type { Intent, Kind } from "../types";
import { Icon } from "./icons";

const KIND_ICON = { security: "shield", "data-integrity": "database", feature: "sparkles", bug: "bug" } as const;

export function KindPill({ kind, compact }: { kind: Kind; compact?: boolean }) {
  return (
    <span class={`k-pill k-pill--${KIND_TONE[kind]}`} title={`Criticality: ${KIND_LABEL[kind]} (set by agents)`}>
      <Icon name={KIND_ICON[kind]} size={12} />
      {compact ? null : KIND_LABEL[kind]}
    </span>
  );
}

export function ValueTag({ amount, observed }: { amount: number; observed?: number }) {
  return (
    <span class="k-pill k-pill--neutral" title="Value: ARR impact, the tenant's single value metric">
      <Icon name="trendingUp" size={12} />
      {money(amount, { sign: true })}
      {observed !== undefined ? <span class="text-done">· {money(observed, { sign: true })} measured</span> : null}
    </span>
  );
}

export function StatusPill({ intent }: { intent: Intent }) {
  const s = intent.status;
  if (s === "waiting-human")
    return (
      <span class="k-pill k-pill--amber">
        <Icon name="hand" size={12} />
        needs a person
      </span>
    );
  if (s === "queued")
    return (
      <span class="k-pill k-pill--neutral">
        <Icon name="clock" size={12} />
        queued
      </span>
    );
  if (s === "merging")
    return (
      <span class="k-pill k-pill--accent">
        <Icon name="gitMerge" size={12} />
        merging
      </span>
    );
  if (s === "canary")
    return (
      <span class="k-pill k-pill--accent">
        <Icon name="flag" size={12} />
        burn-in
      </span>
    );
  if (s === "complete")
    return (
      <span class="k-pill k-pill--done">
        <Icon name="check" size={12} />
        done
      </span>
    );
  return (
    <span class="k-pill k-pill--accent">
      <span class="k-live-dot" />
      working
    </span>
  );
}
