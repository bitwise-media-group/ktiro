/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// The ktiro domain, as the prototype models it.
//
// One artifact: the intent. A feature, a bug, a security fix and a data
// integrity repair are all intents; size never creates a new artifact type.
// An intent is small enough for one orchestrator agent to own end to end in a
// single context window (it may use any number of sub-agents). Every intent
// carries an outcome: a gradable rubric of what "done" means.
//
// Everything here is a projection of markdown in git (ktiro-intents,
// ktiro-agents, ktiro-docs); the forge is a data store, never a workplace.

export type PersonId = string;
export type AgentId =
  | "orchestrator"
  | "definer"
  | "planner"
  | "engineering"
  | "review"
  | "security"
  | "operations"
  | "knowledge"
  | "process";

/**
 * The phases, in order. Intents are the artifact; defining is the phase that
 * produces one.
 *
 * - technical: code review, the outcome grader and security review, run by
 *   agents in parallel and blind. A person is pulled in only when an agent hits
 *   a wall, and always to agree a net-new ADR.
 * - business: the merge set is merged and deployed dark; reviewers see it live
 *   behind a feature flag, with recorded evidence. Acceptance starts the first
 *   rollout to customers.
 * - operate: the flag ramps against a control group to 100%, then a fast-path
 *   intent removes it from the code. Done means both.
 */
export type Phase = "defining" | "planning" | "engineering" | "technical" | "business" | "operate" | "done";
export const PHASES: Phase[] = ["defining", "planning", "engineering", "technical", "business", "operate"];

/** Criticality is set by agents, never by people. Ordered most critical first. */
export type Kind = "security" | "data-integrity" | "feature" | "bug";
export const KINDS: Kind[] = ["security", "data-integrity", "feature", "bug"];

/** Human-defined importance: the last tiebreaker, after criticality and value. */
export type Importance = "low" | "normal" | "high";

export type ImpactRisk = "minimal" | "low" | "moderate" | "high";

export interface Skill {
  name: string;
  /** 1 familiar · 2 proficient · 3 expert */
  level: 1 | 2 | 3;
}

export interface Person {
  id: PersonId;
  name: string;
  initials: string;
  role: string;
  skills: Skill[];
  /** Things they want to grow into: used for stretch assignments. */
  interests: string[];
  availability: { hoursPerWeek: number; timezone: string; window: string };
  /** Share of assignments that may be stretch work, 0–1. */
  stretch: number;
  hue: number;
}

export interface Agent {
  id: AgentId;
  name: string;
  /** The phase (or concern) it serves. */
  serves: string;
  summary: string;
  model: string;
  skills: string[];
  tools: string[];
  definition: string;
  stats: { runs30d: number; success: number; hilRate: number; medianCostUsd: number; inFlight: number };
}

export interface Repo {
  name: string;
  lang: string;
  archetype: "go" | "node" | "python" | "containers" | "terraform";
  purpose: string;
  customerFacing: boolean;
  toolchain: string;
  workflows: string;
  docsSite: string;
  docsFreshDays: number;
  coverage: number;
  benchmarks: boolean;
  adrs: number;
}

/** A gate sits between two phases. People decide, unless the policy lets the agent skip it. */
export interface Gate {
  from: Phase;
  to: Phase;
  name: string;
  state: "upcoming" | "waiting" | "approved" | "auto-skipped" | "changes-requested";
  pSuccess?: number;
  impact?: ImpactRisk;
  decidedBy?: PersonId;
  at?: number;
  why?: string;
}

export interface PhaseRecord {
  phase: Phase;
  enteredAt: number;
  exitedAt?: number;
  /** Wall-clock hours spent waiting in the phase queue before work started. */
  queuedH: number;
  activeH: number;
  /** Hours blocked on a person. */
  hilH: number;
  costUsd: number;
  tokensM: number;
  hilCount: number;
}

export interface Criterion {
  text: string;
  status: "pending" | "passing" | "failing";
  /** What checks it: the outcome grader, a test suite, the canary, or a person. */
  check: "grader" | "tests" | "canary" | "benchmark" | "human";
  evidence?: string;
}

export interface PlanStep {
  repo: string;
  summary: string;
  changes: string[];
  estTurns: number;
  dependsOn?: string[];
}

export interface PullRequest {
  repo: string;
  number: number;
  title: string;
  additions: number;
  deletions: number;
  files: number;
  checks: "passing" | "running" | "failing";
  review: "approved" | "pending" | "concern";
  security: "approved" | "pending" | "concern";
  docs: boolean;
  tests: number;
  benchmark?: string;
  state: "draft" | "open" | "ready" | "merging" | "merged";
}

export interface Evidence {
  id: string;
  kind: "screenshot" | "video";
  title: string;
  caption: string;
  surface: "portal" | "email" | "docs" | "api";
  before?: boolean;
}

export interface Verdict {
  agent: AgentId;
  verdict: "pass" | "concern" | "pending" | "running";
  summary: string;
  findings: { severity: "info" | "low" | "medium" | "high"; text: string }[];
}

export interface AdrCheck {
  adr: string;
  title: string;
  scope: string;
  result: "pass" | "concern" | "n/a";
  note?: string;
}

export interface CanaryMetric {
  name: string;
  unit: string;
  canary: number;
  control: number;
  /** Which direction is better. */
  better: "up" | "down";
  threshold: string;
  ok: boolean;
}

export interface Canary {
  /**
   * Flagger: deployment safety, pod-level traffic shifting. Runs when the merge
   * set lands, before business review, with the flag off for customers.
   */
  deploy: { steps: number[]; step: number; status: "progressing" | "promoted" | "rolled-back"; analysis: string };
  /**
   * OpenFeature flag: exposure. On for reviewers only during business review
   * (step -1); acceptance starts the ramp, measured against a control group.
   */
  exposure: {
    flag: string;
    steps: number[];
    step: number;
    burnInH: number;
    elapsedH: number;
    status: "reviewers-only" | "ramping" | "burn-in" | "complete" | "paused";
  };
  /** Done means the flag is at 100% and gone from the code: a fast-path intent removes it. */
  removal?: { intent: string; status: "raised" | "in-progress" | "merged" };
  metrics: CanaryMetric[];
  /** The tenant's value metric, measured on the exposed cohort vs control. */
  valueObserved?: number;
}

export interface QuestionOption {
  label: string;
  description: string;
  recommended?: boolean;
  preview?: string;
}

export interface Question {
  header: string;
  prompt: string;
  options: QuestionOption[];
  /** Why the agent stopped: a decision branch, or low confidence. */
  trigger: "decision-branch" | "low-confidence" | "gate" | "clarification" | "new-adr";
  confidence?: number;
  context?: string;
}

/**
 * A proposed architecture decision. Net-new ADRs are introduced in technical
 * review and always need a person to agree. Changing an existing ADR is
 * recommended in planning, against a deliberately high burden of proof.
 */
export interface AdrProposal {
  id: string;
  title: string;
  kind: "new" | "change";
  /** "product" for ktiro-docs, or the repository name for a local ADR. */
  scope: string;
  context: string;
  decision: string;
  status: "proposed" | "agreed" | "rejected";
  /** For a change to an existing ADR: what must be shown before it can be accepted. */
  burden?: { item: string; met: boolean }[];
}

/** A finding from patchy: the scanner signal a security intent was raised from. */
export interface FindingRef {
  id: string;
  source: "github-code-scanning" | "wiz" | "google-scc" | "generic";
  rule: string;
  alerts: number;
  advisory?: string;
}

export interface Assignment {
  person: PersonId;
  match: "author" | "skill" | "interest" | "stretch" | "owner";
  detail: string;
}

export type Speaker = { kind: "agent"; id: AgentId } | { kind: "person"; id: PersonId } | { kind: "system" };

export type Card =
  | { type: "question"; question: Question; assigned: Assignment[]; answer?: { label: string; note?: string; by: PersonId } }
  | { type: "gate"; gate: string; summary: string; assigned: Assignment[]; decision?: { result: "approved" | "changes-requested"; note?: string; by: PersonId } }
  | { type: "event"; icon: "check" | "clock" | "skip" | "gitPullRequest" | "gitMerge" | "rocket" | "alertTriangle" | "fileText" | "eye" | "shieldCheck" | "flag"; text: string; tone?: "done" | "accent" | "amber" | "red" | "neutral" }
  | { type: "evidence"; ids: string[] }
  | { type: "plan" };

export interface Message {
  id: string;
  at: number;
  from: Speaker;
  phase: Phase;
  body?: string;
  card?: Card;
}

export interface Intent {
  id: string;
  slug: string;
  title: string;
  kind: Kind;
  /** Why the definer agent classified it this way. */
  kindReason: string;
  /** The tenant's single value metric, in its unit (£ ARR / yr). */
  value: { amount: number; basis: string; confidence: number };
  importance: Importance;
  author: PersonId;
  contributors: PersonId[];
  phase: Phase;
  /** What is happening inside the current phase. */
  status: "queued" | "working" | "waiting-human" | "merging" | "canary" | "complete";
  statusText: string;
  repos: string[];
  dependsOn: string[];
  createdAt: number;
  request: string;
  outcome: Criterion[];
  outOfScope?: string[];
  sizing: { estTurns: number; contextFit: number };
  phases: PhaseRecord[];
  gates: Gate[];
  plan?: { summary: string; steps: PlanStep[]; risks: string[] };
  prs?: PullRequest[];
  evidence?: Evidence[];
  verdicts?: { review: Verdict; security: Verdict; outcome: Verdict };
  adrs?: AdrCheck[];
  adrProposals?: AdrProposal[];
  canary?: Canary;
  /** Security intents raised from a patchy finding carry it here. */
  finding?: FindingRef;
  /** A fast-path intent (e.g. removing a fully rolled-out flag): no functional change, so no business review. */
  fastPath?: { parent: string; reason: string };
  messages: Message[];
  /**
   * Raised by an agent rather than a person: the operations agent from
   * production signals, the security agent from scanners, the process agent
   * from HIL friction (which improves the factory itself). The author is then
   * the person who accepted it.
   */
  origin?: AgentId;
}
