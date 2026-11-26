/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// The knowledge base: ktiro-docs, kept true by the knowledge agent. Product-wide
// decisions live there; each repository keeps its own local decisions next to
// its code, and technical review checks every change against both.

export interface Adr {
  id: string;
  title: string;
  /** "product" for ktiro-docs, else the repository that owns it. */
  scope: string;
  status: "accepted" | "superseded" | "proposed";
  date: string;
  summary: string;
  /** How many intents' reviews have checked a change against it. */
  checks: number;
  supersededBy?: string;
}

export const ADRS: Adr[] = [
  { id: "ADR-0001", title: "The ledger is append-only", scope: "product", status: "accepted", date: "2024-03-11", summary: "Postings are never updated or deleted. Corrections are reversing entries, so the audit trail is the ledger itself.", checks: 64 },
  { id: "ADR-0003", title: "Every service deploys through Flux, every rollout through Flagger", scope: "product", status: "accepted", date: "2025-06-02", summary: "No imperative deploys. Flux reconciles from git; Flagger shifts traffic and promotes on analysis.", checks: 58 },
  { id: "ADR-0004", title: "Feature exposure goes through OpenFeature flags", scope: "product", status: "accepted", date: "2026-02-17", summary: "Deploy and exposure are separate. A change ships dark, is on for reviewers only during business review, ramps across accounts against a control group, and its flag is removed from the code before the intent is done.", checks: 31 },
  { id: "ADR-0005", title: "Feature toggles live in configuration files", scope: "product", status: "superseded", date: "2024-09-30", summary: "Superseded: config-file toggles could not be measured against a control group.", checks: 12, supersededBy: "ADR-0004" },
  { id: "ADR-0007", title: "Money is integer minor units end to end", scope: "product", status: "accepted", date: "2024-03-11", summary: "No floating point anywhere money is stored, computed or rendered. Currency exponent comes from ISO 4217, never an assumed 100.", checks: 71 },
  { id: "ADR-0009", title: "Invoice lines are flat: one line per charge", scope: "product", status: "accepted", date: "2024-05-20", summary: "Every charge renders as exactly one invoice line, so totals, exports and the warehouse never reconstruct a hierarchy. Owner: Dana Whitfield.", checks: 38 },
  { id: "ADR-0010", title: "Every repository consumes the shared toolchain", scope: "product", status: "accepted", date: "2025-11-04", summary: "Each repository pins the toolchain submodule and calls the reusable workflows, so lint, build, test and docs run the same way everywhere.", checks: 49 },
  { id: "ADR-0012", title: "Reads never write: previews are side-effect free", scope: "product", status: "accepted", date: "2025-08-21", summary: "Any endpoint that previews, quotes or simulates must be safe to call any number of times.", checks: 22 },
  { id: "ADR-0003", title: "Proration is computed in one place", scope: "billing-engine", status: "accepted", date: "2025-01-14", summary: "A single pure function computes proration for billing, previews and credit notes.", checks: 9 },
  { id: "ADR-0002", title: "Every money figure has a text explanation", scope: "customer-portal", status: "accepted", date: "2025-05-09", summary: "A number the customer pays or receives is always paired with a sentence that says why.", checks: 14 },
  { id: "ADR-0003", title: "Calendar dates are not instants", scope: "customer-portal", status: "accepted", date: "2026-11-25", summary: "A date the customer picks is a local calendar date and is never converted through UTC.", checks: 1 },
  { id: "ADR-0002", title: "Adapters are stateless", scope: "payments-gateway", status: "accepted", date: "2025-03-18", summary: "A PSP adapter translates and forwards; retries, limits and state live outside it.", checks: 17 },
];

export const DIGEST = [
  { at: 2, kind: "shipped" as const, text: "What shipped: Rotate webhook signing secrets without dropping deliveries", intent: "0131" },
  { at: 2, kind: "adr" as const, text: "ADR-0014 proposed in technical review: one rate limiter per payment provider (waiting for a person to agree)", intent: "0138" },
  { at: 5, kind: "adr" as const, text: "ADR-0009 change recommended in planning: group tier lines under their charge (burden of proof 3 of 5)", intent: "0143" },
  { at: 9, kind: "architecture" as const, text: "Architecture map: payments-gateway → ledger-api posting path redrawn with the idempotent intake", intent: "0139" },
  { at: 20, kind: "glossary" as const, text: "Glossary: added 'lookalike delivery' and 'reversing entry'" },
  { at: 30, kind: "architecture" as const, text: "Flag inventory: portal.seat-audit-log at 100%, removal in flight as fast-path 0155", intent: "0155" },
  { at: 52, kind: "adr" as const, text: "customer-portal ADR-0003 accepted: calendar dates are not instants", intent: "0144" },
];

export const GLOSSARY: { term: string; definition: string }[] = [
  { term: "Intent", definition: "The one artifact. A feature, a bug, a security fix and a data repair are all intents. Small enough for one orchestrator agent to own end to end in one context window." },
  { term: "Defining", definition: "The first phase: where an intent is produced. The definer agent turns a request into an outcome rubric, a criticality, a value estimate and a size; the author accepts it." },
  { term: "Technical review", definition: "Code review, the outcome grader and security review, run by agents in parallel and blind to each other. A person comes in only when an agent hits a wall, and always to agree a net-new ADR." },
  { term: "Business review", definition: "The merge set is merged and deployed dark; people see the result live behind a reviewers-only flag, with recorded screenshots and video. Acceptance starts the first rollout to customers." },
  { term: "Dark deploy", definition: "A merge set deployed through Flux and Flagger with its flag off for customers. Safe to run in production because nobody outside the reviewers can reach it." },
  { term: "Reviewers-only flag", definition: "The OpenFeature segment that turns a flag on for the people reviewing an intent, so business review happens on the real, live system." },
  { term: "Fast path", definition: "An intent with no functional change, such as removing a flag at 100%. It skips defining and planning, rides alongside the WIP limits, and skips business review." },
  { term: "Done", definition: "The flag is at 100% of customers and removed from the code, and every outcome criterion holds. Shipping is not done; rolling out is not done." },
  { term: "Finding", definition: "patchy's unit: scanner alerts (CodeQL, Wiz, Security Command Center) accumulated into one finding and investigated. A finding worth remediating becomes a security intent, which outranks every other kind." },
  { term: "Net-new ADR", definition: "A new architecture decision proposed in technical review when a change sets a rule others must follow. It is never recorded without a person agreeing. Changing an existing ADR is recommended only in planning, against a high burden of proof." },
  { term: "Outcome", definition: "The intent's rubric of what done means: criteria a grader, a test suite, a benchmark, a canary or a person can check. Not an opinion." },
  { term: "Criticality", definition: "Security, then data integrity, then feature, then bug. Set by agents, never by people; people can dispute it." },
  { term: "Value metric", definition: "The tenant's single, measurable success metric. For Ledgerline: ARR impact in £ per year. Estimated at intent time, measured during burn-in." },
  { term: "Importance", definition: "A person's view of how much an intent matters. The last tiebreaker, after criticality and value." },
  { term: "Gate", definition: "The checkpoint between two of the six phases (defining, planning, engineering, technical review, business review, operate). A person decides, unless the agent's p(success) is high and the impact is low enough for policy to let it skip." },
  { term: "HIL", definition: "Human in the loop: any time an agent stops for a person, at a gate, at a decision branch, when it loses confidence or hits a wall, or to agree an ADR. Every HIL in engineering and both reviews is mined by the process agent." },
  { term: "Merge set", definition: "Every pull request an intent needs, across every repository. Reviewed as one in technical review, and merged together only when all are ready, before business review." },
  { term: "Merge lane", definition: "One intent merges at a time, across however many repositories it touches. Merging is sequenced by intent, not by repository." },
  { term: "Burn-in", definition: "The period an exposed change must hold every threshold, ramping to 100%, before its flag can be removed and its outcome confirmed." },
  { term: "Control group", definition: "The accounts not exposed to a flag, matched on plan tier and volume, that every canary signal is compared against." },
  { term: "Bug reserve", definition: "The share of in-flight slots reserved for bugs, so features never starve them." },
  { term: "Context fit", definition: "How much of one orchestrator's context window an intent is expected to need. Anything that would not fit is split into dependent intents." },
  { term: "WIP limit", definition: "The strict maximum number of intents in each phase at once. Anything more waits in that phase's queue, ordered by priority." },
];
