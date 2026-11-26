/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// The process agent's proposals: friction mined from every HIL interaction in
// engineering, technical review and business review, clustered by cause, and
// turned into changes to the factory's own tools (the agents and their skills,
// the shared toolchain, and the reusable verification workflows). Each
// proposal becomes an intent like any other once a person accepts it.

/** The phases whose HIL interactions the process agent mines. */
export type HilPhase = "engineering" | "technical" | "business";

export type ProposalTarget = "ktiro-agents" | "toolchain" | "github-workflows";

export interface Proposal {
  id: string;
  title: string;
  target: ProposalTarget;
  /** The friction cluster the proposal comes from. */
  friction: {
    summary: string;
    hilCount: number;
    medianWaitH: number;
    phases: HilPhase[];
    examples: string[];
  };
  change: string;
  /** Expected drop in HIL interactions per month once the change ships. */
  expectedHilReduction: number;
  status: "proposed" | "intent" | "shipped";
  /** The intent it became, once accepted. */
  intent?: string;
}

export const PROPOSALS: Proposal[] = [
  {
    id: "p-31",
    title: "Teach the engineering agent the expand/contract migration pattern",
    target: "ktiro-agents",
    friction: {
      summary: "Engineering stopped to ask whether a schema change was safe to run on a large table.",
      hilCount: 6,
      medianWaitH: 3.2,
      phases: ["engineering"],
      examples: ["0139", "0133", "0126"],
    },
    change: "Add an `expand-contract-migrations` skill to engineering-agent: concurrent index builds, backfill in batches, contract only after the code that needs the old shape is gone.",
    expectedHilReduction: 4,
    status: "intent",
    intent: "0145",
  },
  {
    id: "p-32",
    title: "Flag blocking DDL in the shared toolchain lint",
    target: "toolchain",
    friction: {
      summary: "Technical review hit the same wall three times: a migration that would take a lock on a hot table, which only a person could rule on.",
      hilCount: 3,
      medianWaitH: 2.1,
      phases: ["technical"],
      examples: ["0139", "0126"],
    },
    change: "A `migrations-lint` step in the go and python archetypes: CREATE INDEX without CONCURRENTLY, ALTER TABLE … SET NOT NULL without a prior CHECK, and column type changes on tables over a size threshold.",
    expectedHilReduction: 3,
    status: "proposed",
  },
  {
    id: "p-33",
    title: "Capture customer-facing evidence in every supported locale and zone",
    target: "ktiro-agents",
    friction: {
      summary: "People in business review asked for screenshots in another locale or time zone before accepting.",
      hilCount: 5,
      medianWaitH: 6.5,
      phases: ["business"],
      examples: ["0144", "0135", "0128"],
    },
    change: "Extend review-agent's `evidence-capture` skill: record each changed screen in en-GB and the account's top two locales, and in UTC±12 for anything that shows a date.",
    expectedHilReduction: 4,
    status: "proposed",
  },
  {
    id: "p-34",
    title: "Check docs-site links in the reusable CI workflow",
    target: "github-workflows",
    friction: {
      summary: "Technical review stopped four times on broken cross-repository links in docs sites and asked a person whether they blocked.",
      hilCount: 4,
      medianWaitH: 1.4,
      phases: ["technical"],
      examples: ["0130", "0128"],
    },
    change: "Add a link-check step to the `docs-build` job of the reusable ci workflow, resolving links across every repository's docs site.",
    expectedHilReduction: 3,
    status: "shipped",
  },
  {
    id: "p-35",
    title: "Calibrate value estimates against what canaries measure",
    target: "ktiro-agents",
    friction: {
      summary: "Business reviewers questioned the value estimate before accepting a rollout; measured values ran 13% below estimates on average.",
      hilCount: 7,
      medianWaitH: 0.8,
      phases: ["engineering", "business"],
      examples: ["0128", "0131", "0133"],
    },
    change: "Feed every confirmed outcome's measured value back into the definer's `value-estimation` skill as a calibration table by kind and repository.",
    expectedHilReduction: 5,
    status: "proposed",
  },
];

/** The monthly HIL count the factory is trying to bring down, by phase. */
export const HIL_TREND = [
  { month: "Jun", engineering: 41, technical: 12, business: 17 },
  { month: "Jul", engineering: 38, technical: 11, business: 16 },
  { month: "Aug", engineering: 33, technical: 9, business: 15 },
  { month: "Sep", engineering: 30, technical: 8, business: 13 },
  { month: "Oct", engineering: 27, technical: 7, business: 12 },
  { month: "Nov", engineering: 24, technical: 5, business: 11 },
];
