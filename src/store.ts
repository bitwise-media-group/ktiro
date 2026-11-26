/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// In-memory state and the scripted flows that make the prototype feel alive.
//
// Nothing persists: a reload resets the demo. Every action mutates a copy of
// the state and notifies subscribers; scripted flows are short sequences of
// timed steps (an agent "working") that end by moving the intent along and
// pulling the next queued intent into any slot that freed up.
//
// The lifecycle the scripts follow:
//   engineering → technical review (agents, blind; a person only at a wall or
//   for a net-new ADR) → merge set merged and deployed dark → business review
//   (live behind the flag, reviewers only) → acceptance starts the rollout →
//   operate (ramp and burn-in to 100%) → a fast-path intent removes the flag
//   → done.

import { useEffect, useState } from "preact/hooks";
import { GATE_DEFS } from "./data/intents";
import { INTENTS } from "./data/intents";
import { NOW, PERSONAS } from "./data/org";
import { PHASE_LABEL } from "./format";
import { activeIn, hasSlot, nextToPull, wipLimit } from "./priority";
import type { AgentId, Assignment, Canary, Card, Intent, Message, Phase, PersonId, Speaker } from "./types";

const LOADED_AT = Date.now();
/** The demo clock: fixed start, then real time. */
export const now = () => NOW + (Date.now() - LOADED_AT);

export interface Toast {
  id: number;
  text: string;
  tone: "accent" | "done" | "amber";
  href?: string;
}

export interface State {
  me: PersonId;
  intents: Intent[];
  toasts: Toast[];
  /** Intents an agent is actively "typing" in, for the thread's working indicator. */
  thinking: Record<string, AgentId | undefined>;
}

let state: State = {
  me: PERSONAS[0],
  intents: structuredClone(INTENTS),
  toasts: [],
  thinking: {},
};

const subs = new Set<() => void>();
export const getState = () => state;
function set(fn: (s: State) => State) {
  state = fn(state);
  subs.forEach((f) => f());
}

export function useStore<T>(select: (s: State) => T): T {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return select(state);
}

export const useMe = () => useStore((s) => s.me);
export const useIntent = (id: string) => useStore((s) => s.intents.find((i) => i.id === id));

// ───────────────────────────── helpers ─────────────────────────────

let msgSeq = 1000;
const find = (id: string) => state.intents.find((i) => i.id === id)!;
function update(id: string, fn: (i: Intent) => void) {
  set((s) => ({
    ...s,
    intents: s.intents.map((i) => {
      if (i.id !== id) return i;
      const copy = structuredClone(i);
      fn(copy);
      return copy;
    }),
  }));
}
function say(id: string, from: Speaker, body?: string, card?: Card) {
  update(id, (i) => {
    const m: Message = { id: `m${++msgSeq}`, at: now(), from, phase: i.phase === "done" ? "operate" : i.phase, body, card };
    i.messages.push(m);
  });
}
const agentSpeaker = (id: AgentId): Speaker => ({ kind: "agent", id });
const SYSTEM: Speaker = { kind: "system" };
const event = (icon: Extract<Card, { type: "event" }>["icon"], text: string, tone?: Extract<Card, { type: "event" }>["tone"]): Card => ({
  type: "event",
  icon,
  text,
  tone,
});

function think(id: string, agent: AgentId | undefined) {
  set((s) => ({ ...s, thinking: { ...s.thinking, [id]: agent } }));
}

/** Run timed steps in order. Each step's delay is from the previous step. */
function play(steps: [number, () => void][]) {
  let t = 0;
  for (const [delay, fn] of steps) {
    t += delay;
    setTimeout(fn, t);
  }
}

let toastSeq = 0;
export function toast(text: string, tone: Toast["tone"] = "accent", href?: string) {
  const t = { id: ++toastSeq, text, tone, href };
  set((s) => ({ ...s, toasts: [...s.toasts, t] }));
  setTimeout(() => set((s) => ({ ...s, toasts: s.toasts.filter((x) => x.id !== t.id) })), 5200);
}

export function setMe(id: PersonId) {
  set((s) => ({ ...s, me: id }));
}

function closePhase(i: Intent) {
  const rec = i.phases.find((p) => p.phase === i.phase && !p.exitedAt);
  if (rec) rec.exitedAt = now();
}
function openPhase(i: Intent, phase: Phase, queued: boolean) {
  i.phase = phase;
  if (phase !== "done") i.phases.push({ phase, enteredAt: now(), queuedH: 0, activeH: 0, hilH: 0, costUsd: 0, tokensM: 0, hilCount: 0 });
  i.status = queued ? "queued" : "working";
}
function setGate(i: Intent, to: Phase, patch: Partial<Intent["gates"][number]>) {
  const g = i.gates.find((x) => x.to === to);
  if (g) Object.assign(g, { at: now() }, patch);
}

const label = (p: Phase) => PHASE_LABEL[p].toLowerCase();

/** Move an intent to the next phase, or queue it there if the phase is full. */
function advance(id: string, to: Phase, workingText: string): boolean {
  const from = find(id).phase;
  const slot = !!find(id).fastPath || hasSlot(state.intents, to);
  update(id, (i) => {
    closePhase(i);
    openPhase(i, to, !slot);
    i.statusText = slot ? workingText : `Waiting for a ${label(to)} slot (${wipLimit(to)}/${wipLimit(to)} in flight)`;
  });
  if (!slot) {
    say(id, SYSTEM, undefined, event("clock", `Queued for ${label(to)}: WIP limit ${wipLimit(to)} reached. Pulled by priority when a slot frees.`, "amber"));
  }
  pull(from);
  return slot;
}

/** Fill a freed slot with the highest-priority queued intent. */
function pull(phase: Phase) {
  if (phase === "done" || !hasSlot(state.intents, phase)) return;
  const next = nextToPull(state.intents, phase);
  if (!next) return;
  update(next.id, (i) => {
    i.status = "working";
    i.statusText = phase === "technical" ? "Review, security and the grader running, blind to each other" : `Started ${label(phase)}`;
  });
  say(next.id, SYSTEM, undefined, event(phase === "technical" ? "eye" : "check", `Slot freed: pulled into ${label(phase)} by priority`, "accent"));
  toast(`${next.id} pulled into ${label(phase)}`, "accent", `#/intent/${next.id}`);
  if (phase === "technical") runTechnicalReview(next.id);
}

// ───────────────────────────── actions ─────────────────────────────

export function answerQuestion(intentId: string, msgId: string, label: string, note?: string) {
  const me = state.me;
  update(intentId, (i) => {
    const m = i.messages.find((x) => x.id === msgId);
    if (m?.card?.type === "question") m.card.answer = { label, note, by: me };
    if (!i.contributors.includes(me) && i.author !== me) i.contributors.push(me);
    i.status = "working";
    i.statusText = "Applying your decision";
  });
  if (note) say(intentId, { kind: "person", id: me }, note);
  toast("Answer recorded in ktiro-intents", "done");
  const script = SCRIPTS[intentId]?.answer;
  if (script) script(label);
  else genericContinue(intentId, label);
}

export function decideGate(intentId: string, msgId: string, result: "approved" | "changes-requested", note?: string) {
  const me = state.me;
  let gateName = "";
  update(intentId, (i) => {
    const m = i.messages.find((x) => x.id === msgId);
    if (m?.card?.type === "gate") {
      m.card.decision = { result, note, by: me };
      gateName = m.card.gate;
    }
    const g = i.gates.find((x) => x.name === gateName);
    if (g) {
      g.state = result;
      g.decidedBy = me;
      g.at = now();
    }
    if (!i.contributors.includes(me) && i.author !== me) i.contributors.push(me);
  });
  if (note) say(intentId, { kind: "person", id: me }, note);
  if (result === "changes-requested") {
    update(intentId, (i) => {
      i.status = "working";
      i.statusText = "Revising with your feedback";
    });
    const who: AgentId = find(intentId).phase === "planning" ? "planner" : "orchestrator";
    think(intentId, who);
    play([[1800, () => (think(intentId, undefined), say(intentId, agentSpeaker(who), "Understood. I'll revise and come back with the changes highlighted. Your note is recorded as a HIL decision, so the process agent can learn from it."))]]);
    toast("Feedback sent", "amber");
    return;
  }
  toast(`${gateName}: approved`, "done");
  const script = SCRIPTS[intentId]?.gate;
  if (script) script(gateName);
  else genericGate(intentId, gateName);
}

/** Operate: jump the burn-in clock forward (the demo's stand-in for waiting). */
export function fastForwardCanary(intentId: string) {
  const i = find(intentId);
  const c = i.canary;
  if (!c || i.phase !== "operate" || c.exposure.status === "complete") return;
  update(intentId, (x) => {
    const e = x.canary!.exposure;
    e.elapsedH = Math.min(e.burnInH, e.elapsedH + 12);
    const frac = e.elapsedH / e.burnInH;
    e.step = Math.min(e.steps.length - 1, Math.max(e.step, Math.floor(frac * (e.steps.length - 1)) + (frac >= 1 ? 1 : 0)));
    e.status = "burn-in";
    x.canary!.valueObserved = Math.round(((x.canary!.valueObserved ?? 0) + x.value.amount * 0.12) / 100) * 100;
    x.statusText = `Burn-in: flag at ${e.steps[e.step]}% of accounts, ${e.elapsedH} of ${e.burnInH} hours`;
  });
  if (find(intentId).canary!.exposure.elapsedH >= find(intentId).canary!.exposure.burnInH) completeRollout(intentId);
}

/** The flag reached 100% with every criterion holding: raise the fast path that removes it. */
function completeRollout(intentId: string) {
  const i = find(intentId);
  const measured = Math.round(i.value.amount * 0.87);
  update(intentId, (x) => {
    const e = x.canary!.exposure;
    e.step = e.steps.length - 1;
    e.status = "complete";
    x.canary!.valueObserved = measured;
    x.outcome.forEach((c) => (c.status = "passing"));
    x.outcome.push({ text: "The flag is removed from the code", status: "pending", check: "tests" });
    x.statusText = "Flag at 100% · removing it from the code";
  });
  say(
    intentId,
    agentSpeaker("operations"),
    `Burn-in complete and every criterion held. Measured against the control group: **+£${measured.toLocaleString("en-GB")} ARR** (estimate £${i.value.amount.toLocaleString("en-GB")}). The flag is at **100%**; it isn't done until the flag is gone from the code, so I'm raising a fast-path intent to remove it.`,
    event("flag", `${i.canary!.exposure.flag} → 100%`, "done"),
  );
  const childId = raiseFlagRemoval(intentId);
  play([
    [900, () => runFastPath(childId)],
  ]);
}

function raiseFlagRemoval(parentId: string): string {
  const p = find(parentId);
  const id = nextId();
  const flag = p.canary!.exposure.flag;
  const child: Intent = {
    id,
    slug: `remove-flag-${flag.replace(/[^a-z0-9]+/g, "-")}`,
    title: `Remove the ${flag} flag from the code`,
    kind: p.kind,
    kindReason: "Inherits the parent's criticality. No functional change: the flag is on for every account.",
    value: { amount: 0, basis: `No new value: completes ${parentId}.`, confidence: 1 },
    importance: "normal",
    author: p.author,
    contributors: [],
    origin: "operations",
    fastPath: { parent: parentId, reason: "Flag at 100% with every criterion holding through burn-in" },
    phase: "engineering",
    status: "working",
    statusText: "Fast path: removing the flag and the code path it guarded",
    repos: p.repos.filter((r) => p.prs?.some((x) => x.repo === r)),
    dependsOn: [],
    createdAt: now(),
    request: `Delete \`${flag}\` and the code path it guarded, so the behaviour is unconditional.`,
    outcome: [
      { text: `No reference to ${flag} remains in any repository`, status: "pending", check: "tests" },
      { text: "Behaviour is identical with the flag gone", status: "pending", check: "grader" },
    ],
    sizing: { estTurns: 15, contextFit: 0.05 },
    phases: [{ phase: "engineering", enteredAt: now(), queuedH: 0, activeH: 0, hilH: 0, costUsd: 0.5, tokensM: 0.2, hilCount: 0 }],
    gates: GATE_DEFS.map((d, k) => ({
      ...d,
      state: k < 2 ? "auto-skipped" : "upcoming",
      pSuccess: k < 2 ? 0.99 : undefined,
      impact: k < 2 ? "minimal" : undefined,
      why: k < 2 ? "Fast path: raised by operations-agent." : k === 4 ? "Will be skipped: no functional change to review." : undefined,
      at: k < 2 ? now() : undefined,
    })),
    messages: [
      { id: `m${++msgSeq}`, at: now(), from: agentSpeaker("operations"), phase: "engineering", body: `Raised from **${parentId}**: \`${flag}\` is at 100%. Fast path: straight to engineering, and business review is skipped because nothing changes for customers.` },
    ],
  };
  set((s) => ({ ...s, intents: [...s.intents, child] }));
  update(parentId, (x) => (x.canary!.removal = { intent: id, status: "in-progress" }));
  toast(`${id}: fast path raised to remove ${flag}`, "accent", `#/intent/${id}`);
  return id;
}

function runFastPath(id: string) {
  const parent = find(id).fastPath!.parent;
  play([
    [1200, () => {
      update(id, (i) => {
        i.prs = i.repos.map((repo, k) => ({ repo, number: 950 + k, title: `Remove ${find(parent).canary!.exposure.flag}`, additions: 2, deletions: 30 + k * 11, files: 2 + k, checks: "passing", review: "pending", security: "pending", docs: true, tests: 20 + k * 9, state: "open" }));
        setGate(i, "technical", { state: "auto-skipped", pSuccess: 0.98, impact: "minimal" });
        i.outcome[0].status = "passing";
      });
      advance(id, "technical", "Fast path: agents reviewing");
    }],
    [1400, () => {
      update(id, (i) => {
        i.verdicts = {
          review: { agent: "review", verdict: "pass", summary: "Deletion only; snapshots unchanged.", findings: [] },
          security: { agent: "security", verdict: "pass", summary: "Deletion only.", findings: [] },
          outcome: { agent: "orchestrator", verdict: "pass", summary: "2 of 2 criteria passing.", findings: [] },
        };
        i.prs!.forEach((p) => ((p.review = "approved"), (p.security = "approved"), (p.state = "merged")));
        i.outcome[1].status = "passing";
        setGate(i, "business", { state: "auto-skipped", pSuccess: 0.99, impact: "minimal" });
        setGate(i, "operate", { state: "auto-skipped", why: "Skipped: no functional change to review." });
      });
      say(id, SYSTEM, undefined, event("gitMerge", "Technically sound · merged · business review skipped (no functional change)", "done"));
    }],
    [1200, () => {
      update(id, (i) => {
        closePhase(i);
        i.phase = "done";
        i.status = "complete";
        i.statusText = "Flag removed";
        setGate(i, "done", { state: "auto-skipped", pSuccess: 0.99, impact: "minimal" });
      });
      say(id, agentSpeaker("operations"), "Deployed. The flag is gone from the code and from flagd.", event("check", "Flag removed", "done"));
      confirmOutcome(parent);
    }],
  ]);
}

function confirmOutcome(intentId: string) {
  const i = find(intentId);
  update(intentId, (x) => {
    x.outcome.forEach((c) => (c.status = "passing"));
    if (x.canary?.removal) x.canary.removal.status = "merged";
    closePhase(x);
    x.phase = "done";
    x.status = "complete";
    x.statusText = "Outcome confirmed · flag removed";
    setGate(x, "done", { state: "auto-skipped", pSuccess: 0.97, impact: "minimal", why: "Flag at 100% and removed; every criterion graded passing." });
  });
  say(intentId, agentSpeaker("orchestrator"), undefined, event("check", `Done: flag at 100% and removed by ${i.canary?.removal?.intent ?? "a fast-path intent"}`, "done"));
  say(intentId, agentSpeaker("knowledge"), "Digest written to ktiro-docs: *What shipped: " + i.title + "*. Each repository's docs site already carries its own page from engineering.", event("fileText", `ktiro-docs/shipped/${i.id}-${i.slug}.md`, "neutral"));
  toast(`${intentId} done: outcome confirmed, flag removed`, "done", `#/intent/${intentId}`);
  drainRollouts();
  pull("operate");
}

export interface Draft {
  title: string;
  request: string;
  kind: Intent["kind"];
  kindReason: string;
  value: Intent["value"];
  importance: Intent["importance"];
  repos: string[];
  outcome: Intent["outcome"];
  dependsOn: string[];
  sizing: Intent["sizing"];
}

const nextId = () => String(Math.max(...state.intents.map((i) => Number(i.id))) + 1).padStart(4, "0");

/** Submit a new intent from the definer conversation. Returns its id. */
export function createIntent(d: Draft, transcript: Message[]): string {
  const id = nextId();
  const slot = hasSlot(state.intents, "defining");
  const intent: Intent = {
    id,
    slug: d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40),
    title: d.title,
    kind: d.kind,
    kindReason: d.kindReason,
    value: d.value,
    importance: d.importance,
    author: state.me,
    contributors: [],
    phase: "defining",
    status: slot ? "waiting-human" : "queued",
    statusText: slot ? "Waiting for you to accept the intent" : `Queued for defining (${wipLimit("defining")}/${wipLimit("defining")} in flight)`,
    repos: d.repos,
    dependsOn: d.dependsOn,
    createdAt: now(),
    request: d.request,
    outcome: d.outcome,
    sizing: d.sizing,
    phases: [{ phase: "defining", enteredAt: now(), queuedH: 0, activeH: 0.1, hilH: 0, costUsd: 0.4, tokensM: 0.2, hilCount: 1 }],
    gates: GATE_DEFS.map((g) => ({ ...g, state: "upcoming" as const })),
    messages: transcript,
  };
  set((s) => ({ ...s, intents: [...s.intents, intent] }));
  toast(`Intent ${id} recorded: ktiro-intents/intents/${id}-${intent.slug}/intent.md`, "done", `#/intent/${id}`);
  return id;
}

// ───────────────────────────── the pipeline ─────────────────────────────

/** Technical review: review, security and the grader run blind; nobody is asked unless they hit a wall. */
function runTechnicalReview(id: string) {
  update(id, (i) => {
    i.verdicts = {
      review: { agent: "review", verdict: "running", summary: "Reviewing the merge set as a whole.", findings: [] },
      security: { agent: "security", verdict: "running", summary: "Reviewing, blind to the code review.", findings: [] },
      outcome: { agent: "orchestrator", verdict: "running", summary: "Grading the outcome rubric.", findings: [] },
    };
  });
  play([
    [1500, () => {
      update(id, (i) => {
        i.verdicts!.security = { agent: "security", verdict: "pass", summary: "No new authorisation paths, secrets or dependencies.", findings: [] };
        i.prs?.forEach((p) => (p.security = "approved"));
      });
      say(id, agentSpeaker("security"), undefined, event("shieldCheck", "Security review passed, blind", "done"));
    }],
    [1300, () => {
      update(id, (i) => {
        i.verdicts!.review = { agent: "review", verdict: "pass", summary: "Meets the outcome; existing ADRs hold, and nothing here sets a new principle.", findings: [] };
        i.prs?.forEach((p) => ((p.review = "approved"), (p.state = "ready")));
      });
      say(id, agentSpeaker("review"), undefined, event("eye", "Code review passed · no net-new ADRs", "done"));
    }],
    [1200, () => {
      update(id, (i) => {
        i.verdicts!.outcome = { agent: "orchestrator", verdict: "pass", summary: "Every pre-rollout criterion graded passing; the rest are measured in operate.", findings: [] };
        setGate(i, "business", { state: "auto-skipped", pSuccess: 0.94, impact: "low", why: "Every agent passed; nothing needed a person." });
      });
      say(id, agentSpeaker("orchestrator"), undefined, event("skip", "Technically sound: every agent passed, nothing needed a person", "accent"));
    }],
    [900, () => mergeAndDeployDark(id)],
  ]);
}

function newCanary(i: Intent): Canary {
  const flag = `${i.repos[0].split("-")[0]}.${i.slug}`;
  const metrics: Canary["metrics"] =
    i.id === "0139"
      ? [
          { name: "Duplicate postings / day", unit: "", canary: 0, control: 0.46, better: "down", threshold: "= 0", ok: true },
          { name: "Webhook p99", unit: "ms", canary: 61, control: 58, better: "down", threshold: "≤ 250 ms", ok: true },
        ]
      : i.id === "0138"
        ? [
            { name: "PSP 429 responses / hr", unit: "", canary: 2, control: 31, better: "down", threshold: "≤ control", ok: true },
            { name: "Card payment p95", unit: "s", canary: 1.9, control: 2.0, better: "down", threshold: "≤ +10% vs control", ok: true },
          ]
        : [
            { name: "Request success", unit: "%", canary: 99.96, control: 99.95, better: "up", threshold: "≥ control − 0.05pp", ok: true },
            { name: "p95 latency", unit: "ms", canary: 236, control: 231, better: "down", threshold: "≤ +10% vs control", ok: true },
          ];
  return {
    deploy: { steps: [10, 25, 50, 100], step: 0, status: "progressing", analysis: "Request success ≥ 99.9% and p99 within 10% of the stable version, per interval; the flag stays off for customers." },
    exposure: { flag, steps: [5, 10, 25, 50, 100], step: -1, burnInH: 72, elapsedH: 0, status: "reviewers-only" },
    metrics,
    valueObserved: 0,
  };
}

function businessReviewers(i: Intent): Assignment[] {
  const out: Assignment[] = [{ person: i.author, match: "author", detail: "You raised this" }];
  const second = i.contributors.find((c) => c !== i.author);
  if (second) out.push({ person: second, match: "interest", detail: "You contributed to this intent" });
  return out;
}

/** Merge the whole set together, deploy it dark, and open business review with the flag on for reviewers only. */
function mergeAndDeployDark(id: string) {
  const i = find(id);
  if (!hasSlot(state.intents, "business")) {
    update(id, (x) => {
      x.status = "merging";
      x.statusText = `Technically sound · waiting for a business review slot (${wipLimit("business")}/${wipLimit("business")}) before merging`;
    });
    say(id, SYSTEM, undefined, event("clock", "The merge set holds until a business review slot frees, so nothing merges that nobody can review.", "amber"));
    return;
  }
  const n = i.prs?.length ?? 0;
  update(id, (x) => {
    x.status = "merging";
    x.statusText = "In the merge lane";
  });
  say(id, agentSpeaker("orchestrator"), `Entering the merge lane: ${n} pull request${n === 1 ? "" : "s"}, merged together by ktiro. No other intent merges until this set lands.`, event("gitMerge", `Merge lane: ${id} holds the lane`, "accent"));
  const steps: [number, () => void][] = [[600, () => update(id, (x) => x.prs?.forEach((p) => (p.state = "merging")))]];
  (i.prs ?? []).forEach((_, k) => steps.push([400, () => update(id, (x) => (x.prs![k].state = "merged"))]));
  steps.push([500, () => {
    say(id, SYSTEM, undefined, event("gitMerge", `Merge set landed: ${n} of ${n} merged together`, "done"));
    update(id, (x) => {
      closePhase(x);
      openPhase(x, "business", false);
      x.statusText = "Deploying dark: Flagger shifting traffic, flag off for customers";
      x.canary = newCanary(x);
    });
    pull("technical");
  }]);
  [1, 2, 3].forEach((k) =>
    steps.push([700, () => update(id, (x) => {
      x.canary!.deploy.step = k;
      if (k === 3) x.canary!.deploy.status = "promoted";
    })]),
  );
  steps.push([600, () => {
    const x = find(id);
    update(id, (y) => {
      y.status = "waiting-human";
      y.statusText = "Live behind the flag: results ready for acceptance";
    });
    say(id, agentSpeaker("operations"), `Deployed dark: Flagger promoted every workload. \`${x.canary!.exposure.flag}\` is **on for reviewers only**: customers see nothing yet.`, event("rocket", "Live behind the flag, reviewers only", "accent"));
    say(
      id,
      agentSpeaker("orchestrator"),
      x.evidence?.length
        ? "Evidence is recorded on the live deployment. Try it yourself (the flag is on for you), then accept to start the rollout."
        : "Nothing visual changes here, so the evidence is the run report: replay results and the repair dry run. Accepting starts the rollout.",
      { type: "gate", gate: "Results accepted", summary: "Review the result live behind the flag. Accepting turns it on for 5% of customers.", assigned: businessReviewers(x) },
    );
    toast(`${id} is in business review, live behind its flag`, "accent", `#/intent/${id}/business`);
  }]);
  play(steps);
}

/** Business acceptance: the flag starts its rollout to customers. */
function startRollout(id: string) {
  if (!hasSlot(state.intents, "operate")) {
    update(id, (x) => {
      x.status = "canary";
      x.statusText = `Accepted · waiting for an operate slot (${wipLimit("operate")}/${wipLimit("operate")}) to start the rollout`;
    });
    say(id, SYSTEM, undefined, event("clock", "Accepted. The rollout starts when an operate slot frees, so every ramp is watched.", "amber"));
    return;
  }
  update(id, (x) => {
    closePhase(x);
    openPhase(x, "operate", false);
    x.status = "canary";
    const e = x.canary!.exposure;
    e.step = 0;
    e.status = "burn-in";
    x.statusText = `Burn-in: flag at ${e.steps[0]}% of accounts, 0 of ${e.burnInH} hours`;
  });
  const x = find(id);
  say(id, agentSpeaker("operations"), `Rollout started: **${x.canary!.exposure.steps[0]}%** of accounts, against a matched control group. Burn-in is ${x.canary!.exposure.burnInH} hours; the flag ramps as each step holds.`, event("flag", `${x.canary!.exposure.flag} → ${x.canary!.exposure.steps[0]}%`, "accent"));
  toast(`${id}: rollout started at ${x.canary!.exposure.steps[0]}%`, "done", `#/intent/${id}/operate`);
  pull("business");
  drainMerges();
}

/** An operate slot freed: start the first accepted rollout that was waiting for one. */
function drainRollouts() {
  const waiting = state.intents.find((i) => i.phase === "business" && i.gates.find((g) => g.to === "operate")?.state === "approved");
  if (waiting) startRollout(waiting.id);
}

// ───────────────────────────── scripts ─────────────────────────────

function genericContinue(intentId: string, label: string) {
  const i = find(intentId);
  const who: AgentId = i.phase === "defining" ? "definer" : i.phase === "planning" ? "planner" : i.phase === "technical" ? "review" : "engineering";
  think(intentId, who);
  play([
    [1600, () => {
      think(intentId, undefined);
      say(intentId, agentSpeaker(who), `Going with **${label}**. Recorded as a decision in the intent's history; continuing.`);
      update(intentId, (x) => (x.statusText = "Working"));
    }],
  ]);
}

function genericGate(intentId: string, gateName: string) {
  const i = find(intentId);
  const g = i.gates.find((x) => x.name === gateName);
  if (!g) return;
  if (g.to === "operate") return startRollout(intentId);
  advance(intentId, g.to, `Started ${label(g.to)}`);
}

type Script = { answer?: (label: string) => void; gate?: (gate: string) => void };

const SCRIPTS: Record<string, Script> = {
  "0139": {
    answer: (label) => {
      const id = "0139";
      const lookalikes = label.startsWith("Both");
      think(id, "engineering");
      play([
        [1400, () => say(id, agentSpeaker("engineering"), `Going with **${label}**. ${lookalikes ? "The three Adyen re-issues will be held for review instead of posted; the repair job reverses all 41." : "Proceeding; I'll note the trade-off in the run report."}`)],
        [1500, () => say(id, agentSpeaker("engineering"), undefined, event("check", "Expand step: unique index built CONCURRENTLY on 180M rows · no lock held > 40 ms", "done"))],
        [1400, () => {
          say(id, agentSpeaker("engineering"), undefined, event("check", "Replay harness: 1–50 redeliveries × 2,450 cases → exactly one posting each", "done"));
          update(id, (i) => (i.outcome[0].status = "passing"));
        }],
        [1300, () => {
          say(id, agentSpeaker("engineering"), undefined, event("check", "Repair dry run: 41 duplicates → 41 reversing entries · runs/0139-repair-dryrun.md", "done"));
          update(id, (i) => {
            i.outcome[1].status = "passing";
            i.outcome[2].status = "passing";
            i.outcome[2].evidence = "p99 61 ms";
          });
        }],
        [1100, () => say(id, agentSpeaker("engineering"), undefined, event("fileText", "Docs sites updated: payments-gateway 'Idempotent intake', ledger-api 'Reversing duplicate postings'", "neutral"))],
        [1200, () => {
          think(id, undefined);
          update(id, (i) => {
            i.prs = [
              { repo: "payments-gateway", number: 688, title: "Idempotent webhook intake with lookalike hold", additions: 521, deletions: 37, files: 13, checks: "passing", review: "pending", security: "pending", docs: true, tests: 58, benchmark: "p99 61 ms", state: "open" },
              { repo: "ledger-api", number: 911, title: "ReverseDuplicatePosting command and repair job", additions: 344, deletions: 8, files: 9, checks: "passing", review: "pending", security: "pending", docs: true, tests: 27, state: "open" },
            ];
            setGate(i, "technical", { state: "auto-skipped", pSuccess: 0.93, impact: "low", why: "Your decision removed the ambiguity; repair is dry-run verified and append-only." });
          });
          say(id, agentSpeaker("orchestrator"), "Engineering is done: tests, benchmark and both docs sites. Confidence rose to **0.93** and the repair is append-only, so the ready-for-review gate can skip a person.", event("skip", "Ready-for-review gate skipped: p(success) 0.93, impact low", "accent"));
        }],
        [900, () => {
          if (advance(id, "technical", "Review, security and the grader running, blind to each other")) runTechnicalReview(id);
        }],
      ]);
    },
  },
  "0138": {
    answer: (label) => {
      const id = "0138";
      const agreed = !label.startsWith("Don't");
      const local = label.includes("local");
      think(id, "review");
      play([
        [1300, () => {
          think(id, undefined);
          update(id, (i) => {
            const p = i.adrProposals?.[0];
            if (p) {
              p.status = agreed ? "agreed" : "rejected";
              if (local) p.scope = "payments-gateway";
            }
          });
          if (agreed) {
            say(id, agentSpeaker("knowledge"), local ? "Recorded as a local decision in payments-gateway's own ADRs." : "Recorded **ADR-0014** in ktiro-docs. Review now checks every PSP adapter against it.", event("fileText", local ? "payments-gateway/docs/adr/0003-psp-rate-limiting.md" : "ktiro-docs/decisions/0014-psp-rate-limiting.md", "done"));
          } else {
            say(id, agentSpeaker("review"), "No ADR recorded. The code stands on its own; I've noted the risk of drift in the run report.");
          }
        }],
        [1200, () => {
          update(id, (i) => setGate(i, "business", { state: "approved", decidedBy: state.me, why: "A person agreed the ADR decision; every agent had passed." }));
          say(id, agentSpeaker("orchestrator"), undefined, event("check", "Technically sound: agents passed and the ADR decision is agreed", "done"));
        }],
        [800, () => mergeAndDeployDark(id)],
      ]);
    },
  },
  "0141": {
    answer: (label) => {
      const id = "0141";
      think(id, "engineering");
      play([
        [1500, () => {
          think(id, undefined);
          say(id, agentSpeaker("engineering"), label.startsWith("Only")
            ? "Going with **explicit delegation**. Adding an `export:delegate` grant, a migration that creates grants for the 6 customers' current usage (listed in the run report), and an authorisation matrix test."
            : `Going with **${label}**. Updating the authorisation matrix accordingly.`);
          update(id, (i) => (i.statusText = "Implementing the authorisation matrix"));
        }],
      ]);
    },
  },
  "0146": {
    answer: (label) => {
      const id = "0146";
      think(id, "definer");
      play([
        [1800, () => {
          think(id, undefined);
          update(id, (i) => {
            i.outcome = label.startsWith("Magic")
              ? [
                  { text: "An admin can share a draft with an accountant via a link scoped to that one draft", status: "pending", check: "grader" },
                  { text: "The accountant can comment without an account; links expire with the draft", status: "pending", check: "tests" },
                  { text: "The admin is notified of each comment within a minute", status: "pending", check: "tests" },
                  { text: "Share links never grant access to anything but their draft", status: "pending", check: "tests" },
                ]
              : [{ text: "Outcome drafted for: " + label, status: "pending", check: "grader" }];
            i.sizing = { estTurns: 130, contextFit: 0.44 };
            i.status = "waiting-human";
            i.statusText = "Waiting for you to accept the intent";
          });
          say(id, agentSpeaker("definer"), `Drafted with **${label}**. The outcome rubric is on the Overview tab: four gradable criteria. Context fit 0.44, so it stays one intent. It touches share links, so security review will look hard at token scoping.`, {
            type: "gate",
            gate: "Intent accepted",
            summary: "Outcome rubric · £18k ARR · feature",
            assigned: [{ person: "kai", match: "author", detail: "You wrote this intent" }],
          });
        }],
      ]);
    },
  },
  "0143": {
    gate: () => {
      const id = "0143";
      update(id, (i) => {
        const p = i.adrProposals?.[0];
        if (p) {
          p.burden?.forEach((b) => (b.met = b.met || b.item.startsWith("Agreement")));
        }
      });
      const started = advance(id, "engineering", "Implementing: ledger-api first");
      if (!started) {
        say(id, agentSpeaker("orchestrator"), `Engineering is at its limit (${activeIn(state.intents, "engineering").length}/${wipLimit("engineering")}). It's next in line when a slot frees. The ADR-0009 change still needs its migration path before it can be recorded; engineering will produce it as part of the plan.`);
      }
    },
  },
};

/** A free-form message to the intent's orchestrator. */
export function sendMessage(intentId: string, text: string) {
  const me = state.me;
  say(intentId, { kind: "person", id: me }, text);
  update(intentId, (i) => {
    if (!i.contributors.includes(me) && i.author !== me) i.contributors.push(me);
  });
  think(intentId, "orchestrator");
  play([
    [1500, () => {
      think(intentId, undefined);
      say(intentId, agentSpeaker("orchestrator"), "Noted, and recorded in the intent's history. If it changes the outcome rubric I'll propose the edit here for you to accept, rather than changing it silently.");
    }],
  ]);
}

/** A business review slot freed: merge and deploy the first technically sound set that was waiting for one. */
function drainMerges() {
  const waiting = state.intents.find(
    (i) => i.phase === "technical" && i.status === "merging" && (i.prs ?? []).every((p) => p.state !== "merged" && p.state !== "merging"),
  );
  if (waiting) mergeAndDeployDark(waiting.id);
}
