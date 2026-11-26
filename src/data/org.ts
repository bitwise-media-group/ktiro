/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// The demo tenant: Ledgerline, a fictional B2B billing platform, and the
// people, agents and repositories that make it up.

import type { Agent, AgentId, Person, Repo } from "../types";

/** The demo clock: everything is relative to this instant. */
export const NOW = Date.parse("2026-11-26T10:00:00Z");
export const hoursAgo = (h: number) => NOW - h * 3_600_000;

export const TENANT = {
  product: "Ledgerline",
  org: "ledgerline",
  tagline: "Billing and revenue ledger for B2B SaaS",
  forge: { kind: "GitHub", org: "ledgerline-eng", app: "ktiro-ledgerline" },
  cluster: { name: "prod-eu-west-2", distro: "EKS 1.35", flux: "v2.8", flagger: "v1.42", openfeature: "flagd 0.13" },
  /** Exactly one value metric: measurable, never subjective. */
  valueMetric: {
    name: "ARR impact",
    unit: "£/yr",
    definition:
      "Change in annual recurring revenue attributable to the change: retained ARR for churn-risk accounts, expansion ARR for upsell paths, protected ARR for risk reduction.",
    source: "data-pipeline · marts.revenue_attribution.arr_delta",
  },
  /** Strict bounds on work in flight, per phase. */
  wip: { defining: 4, planning: 3, engineering: 4, technical: 3, business: 3, operate: 3 } as Record<string, number>,
  /** One intent merges at a time, across every repository it touches. */
  mergeLane: 1,
  /** Share of slots reserved for bugs, so they are never starved by features. */
  bugReserve: 0.2,
  autoSkip: {
    minPSuccess: 0.9,
    maxImpact: "low",
    alwaysHumanFor: ["business review of functional changes", "net-new ADRs", "changes to an existing ADR", "breaking changes"],
  },
};

export const PEOPLE: Person[] = [
  {
    id: "dana",
    name: "Dana Whitfield",
    initials: "DW",
    role: "Staff engineer, ledger",
    skills: [
      { name: "Go", level: 3 },
      { name: "PostgreSQL", level: 3 },
      { name: "Double-entry ledgers", level: 3 },
      { name: "Payments", level: 2 },
      { name: "Kubernetes", level: 2 },
    ],
    interests: ["Frontend accessibility", "Observability"],
    availability: { hoursPerWeek: 12, timezone: "Europe/London", window: "09:00–13:00" },
    stretch: 0.15,
    hue: 212,
  },
  {
    id: "tomas",
    name: "Tomás Reyes",
    initials: "TR",
    role: "Product lead, billing",
    skills: [
      { name: "Pricing & packaging", level: 3 },
      { name: "Billing domain", level: 3 },
      { name: "UX writing", level: 2 },
      { name: "SQL", level: 1 },
    ],
    interests: ["Experimentation", "Data pipelines"],
    availability: { hoursPerWeek: 8, timezone: "America/New_York", window: "10:00–12:00, 15:00–16:00" },
    stretch: 0.1,
    hue: 28,
  },
  {
    id: "aisha",
    name: "Aisha Bello",
    initials: "AB",
    role: "Security engineer",
    skills: [
      { name: "Application security", level: 3 },
      { name: "Threat modelling", level: 3 },
      { name: "OAuth / OIDC", level: 3 },
      { name: "Go", level: 2 },
      { name: "Kubernetes", level: 2 },
    ],
    interests: ["Data integrity", "Double-entry ledgers"],
    availability: { hoursPerWeek: 10, timezone: "Europe/Berlin", window: "13:00–17:00" },
    stretch: 0.2,
    hue: 330,
  },
  {
    id: "kai",
    name: "Kai Nakamura",
    initials: "KN",
    role: "Product designer",
    skills: [
      { name: "Product design", level: 3 },
      { name: "Accessibility", level: 3 },
      { name: "UX writing", level: 2 },
      { name: "TypeScript", level: 1 },
    ],
    interests: ["Design systems", "Billing domain"],
    availability: { hoursPerWeek: 14, timezone: "Asia/Tokyo", window: "10:00–15:00" },
    stretch: 0.2,
    hue: 160,
  },
  {
    id: "rob",
    name: "Rob Mensah",
    initials: "RM",
    role: "Site reliability",
    skills: [
      { name: "Kubernetes", level: 3 },
      { name: "Flux & Flagger", level: 3 },
      { name: "Observability", level: 3 },
      { name: "PostgreSQL", level: 2 },
    ],
    interests: ["Payments"],
    availability: { hoursPerWeek: 10, timezone: "Europe/London", window: "14:00–18:00" },
    stretch: 0.1,
    hue: 260,
  },
  {
    id: "lena",
    name: "Lena Fischer",
    initials: "LF",
    role: "Data engineer",
    skills: [
      { name: "Python", level: 3 },
      { name: "Data pipelines", level: 3 },
      { name: "SQL", level: 3 },
    ],
    interests: ["Pricing & packaging"],
    availability: { hoursPerWeek: 6, timezone: "Europe/Berlin", window: "09:00–11:00" },
    stretch: 0.15,
    hue: 95,
  },
];

/** Who the "Preview as" switcher offers. */
export const PERSONAS = ["dana", "tomas", "aisha", "kai"];

export const person = (id: string) => PEOPLE.find((p) => p.id === id)!;

export const AGENTS: Agent[] = [
  {
    id: "orchestrator",
    name: "orchestrator",
    serves: "Every phase",
    summary:
      "Owns one intent end to end inside a single context window. Dispatches the phase agents as sub-agents, holds the outcome rubric, and stops to ask when a branch or a doubt appears.",
    model: "claude-opus-5-5",
    skills: ["intent-lifecycle", "ask-for-help", "merge-set", "cost-budget"],
    tools: ["ktiro-records", "sub-agents", "kubernetes (read)"],
    definition: "ktiro-agents/agents/orchestrator.yaml",
    stats: { runs30d: 61, success: 0.92, hilRate: 0.34, medianCostUsd: 3.1, inFlight: 14 },
  },
  {
    id: "definer",
    name: "definer-agent",
    serves: "Defining",
    summary:
      "Turns a request into an intent: the outcome rubric, the value estimate against the tenant metric, the criticality, the dependencies, and a sizing check that splits anything too big for one orchestrator.",
    model: "claude-opus-5-5",
    skills: ["intent-writing", "outcome-rubrics", "value-estimation", "criticality", "sizing"],
    tools: ["ktiro-docs (read)", "data-pipeline (read)", "ktiro-intents"],
    definition: "ktiro-agents/agents/definer.yaml",
    stats: { runs30d: 74, success: 0.96, hilRate: 0.41, medianCostUsd: 0.8, inFlight: 4 },
  },
  {
    id: "planner",
    name: "planning-agent",
    serves: "Planning",
    summary:
      "Reads the knowledge base and the repositories, then writes a plan: per-repository changes, their order, the merge set, the risks and the ADRs in play.",
    model: "claude-opus-5-5",
    skills: ["repo-survey", "plan-writing", "adr-lookup", "risk-assessment"],
    tools: ["source (read, SHA-pinned)", "ktiro-docs (read)"],
    definition: "ktiro-agents/agents/planner.yaml",
    stats: { runs30d: 58, success: 0.91, hilRate: 0.28, medianCostUsd: 1.9, inFlight: 3 },
  },
  {
    id: "engineering",
    name: "engineering-agent",
    serves: "Engineering",
    summary:
      "Implements the plan in every repository it names, under the normalised toolchain. Done means tests, benchmarks and the repository's docs site, not just code.",
    model: "claude-opus-5-5",
    skills: ["mise-toolchain", "go-service", "preact-ui", "expand-contract-migrations", "docs-site", "benchmarks"],
    tools: ["source (SHA-pinned)", "mise", "egress broker"],
    definition: "ktiro-agents/agents/engineering.yaml",
    stats: { runs30d: 52, success: 0.87, hilRate: 0.31, medianCostUsd: 9.4, inFlight: 4 },
  },
  {
    id: "review",
    name: "review-agent",
    serves: "Technical review",
    summary:
      "Technical review of the merge set as a whole, blind to the security review: the change against the outcome, the ADRs and the definition of done. Proposes any net-new ADR the change implies, and records the screenshots and walkthroughs business review needs.",
    model: "claude-opus-5-5",
    skills: ["code-review", "adr-conformance", "evidence-capture", "outcome-grading"],
    tools: ["source (read)", "preview environment", "browser (recorded)"],
    definition: "ktiro-agents/agents/review.yaml",
    stats: { runs30d: 49, success: 0.95, hilRate: 0.22, medianCostUsd: 2.6, inFlight: 2 },
  },
  {
    id: "security",
    name: "security-agent",
    serves: "Technical review",
    summary:
      "Reviews the same merge set in parallel and blind: threat model deltas, authorisation paths, secrets, supply chain. Also raises security intents from scanner findings.",
    model: "claude-opus-5-5",
    skills: ["threat-modelling", "authz-review", "supply-chain", "secrets"],
    tools: ["source (read)", "scanners", "sbom"],
    definition: "ktiro-agents/agents/security.yaml",
    stats: { runs30d: 51, success: 0.97, hilRate: 0.12, medianCostUsd: 1.7, inFlight: 2 },
  },
  {
    id: "operations",
    name: "operations-agent",
    serves: "Business review and operate",
    summary:
      "Deploys the merged set dark through Flux and Flagger for business review, ramps the OpenFeature flag against a control group once it is accepted, raises the fast-path intent that removes the flag at 100%, and raises bugs from production signals.",
    model: "claude-sonnet-5-5",
    skills: ["flux", "flagger-canary", "openfeature", "slo-analysis", "rollback"],
    tools: ["kubernetes", "prometheus", "flagd"],
    definition: "ktiro-agents/agents/operations.yaml",
    stats: { runs30d: 44, success: 0.98, hilRate: 0.07, medianCostUsd: 0.6, inFlight: 1 },
  },
  {
    id: "knowledge",
    name: "knowledge-agent",
    serves: "Knowledge base",
    summary:
      "Keeps ktiro-docs true: product-wide ADRs, the glossary, the architecture map, and a digest of every intent that ships.",
    model: "claude-sonnet-5-5",
    skills: ["docs-site", "adr-writing", "architecture-map"],
    tools: ["ktiro-docs", "every repository (read)"],
    definition: "ktiro-agents/agents/knowledge.yaml",
    stats: { runs30d: 38, success: 0.99, hilRate: 0.03, medianCostUsd: 0.4, inFlight: 0 },
  },
  {
    id: "process",
    name: "process-agent",
    serves: "The factory",
    summary:
      "Reads every human-in-the-loop interaction from engineering and review, finds the friction that repeats, and proposes changes to the agents, the toolchain and the workflows as intents of their own.",
    model: "claude-opus-5-5",
    skills: ["friction-mining", "skill-authoring", "toolchain", "workflow-authoring"],
    tools: ["ktiro-intents (read)", "ktiro-agents", "toolchain", "github-workflows"],
    definition: "ktiro-agents/agents/process.yaml",
    stats: { runs30d: 9, success: 1, hilRate: 0.0, medianCostUsd: 1.2, inFlight: 1 },
  },
];

export const agent = (id: AgentId) => AGENTS.find((a) => a.id === id)!;

export const REPOS: Repo[] = [
  { name: "ledger-api", lang: "Go", archetype: "go", purpose: "Double-entry ledger and the public API", customerFacing: true, toolchain: "v4.2.0", workflows: "v8.4.0", docsSite: "docs.ledgerline.dev/ledger-api", docsFreshDays: 1, coverage: 0.86, benchmarks: true, adrs: 7 },
  { name: "billing-engine", lang: "Go", archetype: "go", purpose: "Subscriptions, proration and invoice runs", customerFacing: false, toolchain: "v4.2.0", workflows: "v8.4.0", docsSite: "docs.ledgerline.dev/billing-engine", docsFreshDays: 2, coverage: 0.82, benchmarks: true, adrs: 5 },
  { name: "payments-gateway", lang: "Go", archetype: "go", purpose: "PSP adapters and inbound payment webhooks", customerFacing: false, toolchain: "v4.2.0", workflows: "v8.4.0", docsSite: "docs.ledgerline.dev/payments-gateway", docsFreshDays: 0, coverage: 0.79, benchmarks: true, adrs: 4 },
  { name: "invoice-renderer", lang: "TypeScript", archetype: "node", purpose: "PDF and HTML invoice rendering", customerFacing: true, toolchain: "v4.2.0", workflows: "v8.4.0", docsSite: "docs.ledgerline.dev/invoice-renderer", docsFreshDays: 6, coverage: 0.74, benchmarks: true, adrs: 2 },
  { name: "customer-portal", lang: "TypeScript", archetype: "node", purpose: "The customer-facing web app", customerFacing: true, toolchain: "v4.2.0", workflows: "v8.4.0", docsSite: "docs.ledgerline.dev/customer-portal", docsFreshDays: 1, coverage: 0.71, benchmarks: false, adrs: 3 },
  { name: "notifications", lang: "Go", archetype: "go", purpose: "Email, Slack and outbound webhooks", customerFacing: true, toolchain: "v4.1.3", workflows: "v8.4.0", docsSite: "docs.ledgerline.dev/notifications", docsFreshDays: 3, coverage: 0.8, benchmarks: true, adrs: 2 },
  { name: "data-pipeline", lang: "Python", archetype: "python", purpose: "Warehouse models, revenue attribution, the value metric", customerFacing: false, toolchain: "v4.2.0", workflows: "v8.4.0", docsSite: "docs.ledgerline.dev/data-pipeline", docsFreshDays: 4, coverage: 0.77, benchmarks: false, adrs: 3 },
  { name: "platform", lang: "YAML", archetype: "containers", purpose: "Flux, Flagger and flagd manifests for every environment", customerFacing: false, toolchain: "v4.2.0", workflows: "v8.4.0", docsSite: "docs.ledgerline.dev/platform", docsFreshDays: 2, coverage: 0, benchmarks: false, adrs: 6 },
];

/** The factory's own repositories: ktiro is the only writer to all of them. */
export const FACTORY_REPOS = [
  { name: "ktiro-intents", purpose: "Every intent, plan, HIL decision and run report, as markdown", files: 1842 },
  { name: "ktiro-agents", purpose: "kagent declarative agents and their skills", files: 214 },
  { name: "ktiro-docs", purpose: "The product knowledge base, kept by the knowledge agent", files: 396 },
  { name: "toolchain", purpose: "The shared mise toolchain every repository consumes as .mise/", files: 188 },
  { name: "github-workflows", purpose: "The reusable verification workflows every repository calls", files: 41 },
];
