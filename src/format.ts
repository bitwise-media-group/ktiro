/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

import { now } from "./store";
import type { Kind, Phase } from "./types";

export const PHASE_LABEL: Record<Phase, string> = {
  defining: "Defining",
  planning: "Planning",
  engineering: "Engineering",
  technical: "Technical review",
  business: "Business review",
  operate: "Operate",
  done: "Done",
};

export const PHASE_SHORT: Record<Phase, string> = {
  defining: "Define",
  planning: "Plan",
  engineering: "Build",
  technical: "Tech review",
  business: "Biz review",
  operate: "Operate",
  done: "Done",
};

export const KIND_LABEL: Record<Kind, string> = {
  security: "Security",
  "data-integrity": "Data integrity",
  feature: "Feature",
  bug: "Bug",
};

export const KIND_TONE: Record<Kind, string> = {
  security: "sec",
  "data-integrity": "data",
  feature: "feat",
  bug: "bug",
};

export function money(n: number, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const sign = opts.sign && n > 0 ? "+" : n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (opts.compact !== false && abs >= 1000) {
    const k = abs / 1000;
    return `${sign}£${k >= 100 ? k.toFixed(0) : k.toFixed(k % 1 === 0 ? 0 : 1)}k`;
  }
  return `${sign}£${abs.toLocaleString("en-GB")}`;
}

export const usd = (n: number) => `$${n < 10 ? n.toFixed(2) : n.toFixed(n < 100 ? 1 : 0)}`;

export function hours(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${h < 10 ? h.toFixed(1).replace(/\.0$/, "") : Math.round(h)}h`;
  return `${(h / 24).toFixed(1).replace(/\.0$/, "")}d`;
}

export function ago(t: number): string {
  const s = Math.max(0, (now() - t) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
