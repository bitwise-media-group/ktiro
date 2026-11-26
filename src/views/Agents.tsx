/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// The agents: kagent declarative definitions and their skills, kept in
// ktiro-agents. The process agent's proposals sit at the centre: every HIL
// interaction in engineering, technical review and business review is evidence
// of friction, and the fix is a change to the factory's own tools, raised as an
// intent like any other.

import { useState } from "preact/hooks";
import { AGENTS, TENANT } from "../data/org";
import { HIL_TREND, PROPOSALS, type Proposal } from "../data/process";
import { AgentAvatar } from "../components/Avatar";
import { Icon, type IconName } from "../components/icons";
import { Markdown } from "../components/Markdown";
import { MiniRail } from "../components/PhaseRail";
import { KindPill } from "../components/Pills";
import { PHASE_LABEL, pct, usd } from "../format";
import { hrefIntent } from "../router";
import { toast, useStore } from "../store";
import type { Agent, AgentId, Intent } from "../types";

/** Which intents an agent is working on right now. */
function workingOn(id: AgentId, intents: Intent[]): Intent[] {
  const live = intents.filter((i) => i.phase !== "done" && i.status !== "queued");
  switch (id) {
    case "orchestrator":
      return live;
    case "definer":
      return live.filter((i) => i.phase === "defining");
    case "planner":
      return live.filter((i) => i.phase === "planning");
    case "engineering":
      return live.filter((i) => i.phase === "engineering");
    case "review":
      return live.filter((i) => i.phase === "technical");
    case "security":
      // Technical review, plus the security intents it raised from patchy findings that are still being defined.
      return live.filter((i) => i.phase === "technical" || (i.phase === "defining" && !!i.finding));
    case "operations":
      // Dark deploys and reviewers-only flags in business review, then the rollout in operate.
      return live.filter((i) => i.phase === "business" || i.phase === "operate");
    case "knowledge":
      // ADR proposals waiting for agreement are its to record.
      return live.filter((i) => i.adrProposals?.some((p) => p.status === "proposed"));
    case "process":
      return intents.filter((i) => i.origin === "process" && i.phase !== "done");
    default:
      return [];
  }
}

export function AgentsView({ id }: { id?: string }) {
  const found = id ? AGENTS.find((a) => a.id === id) : undefined;
  if (id && found) return <AgentDetail a={found} />;
  return <AgentIndex />;
}

// ───────────────────────────── index ─────────────────────────────

function AgentIndex() {
  return (
    <div>
      <div class="k-eyebrow">Agents</div>
      <h1 class="mt-1 mb-0 text-[26px] leading-tight font-bold tracking-[-0.01em]">The agents</h1>
      <p class="mt-1.5 mb-0 max-w-[76ch] text-[14.5px] text-muted">
        Each agent is a kagent declarative definition and a set of skills in <span class="k-mono-tag">ktiro-agents</span>. Changing an agent is an intent like any other:
        planned, reviewed blind, and rolled out with a measured outcome.
      </p>

      <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {AGENTS.map((a) => (
          <AgentCard key={a.id} a={a} />
        ))}
      </div>

      <ProcessSection />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" | "done" }) {
  return (
    <div class="min-w-0">
      <div class={`font-mono text-[15px] font-bold ${tone === "amber" ? "text-amber" : tone === "done" ? "text-done" : "text-fg"}`}>{value}</div>
      <div class="text-[11.5px] text-muted">{label}</div>
    </div>
  );
}

function AgentCard({ a }: { a: Agent }) {
  const intents = useStore((s) => s.intents);
  const inFlight = workingOn(a.id, intents).length;
  return (
    <a href={`#/agents/${a.id}`} class={`k-card k-card--hover group flex flex-col p-4 text-fg no-underline ${a.id === "process" ? "border-[color-mix(in_oklab,var(--k-accent)_40%,var(--k-line))]" : ""}`}>
      <div class="flex items-center gap-2.5">
        <AgentAvatar id={a.id} size={32} />
        <div class="min-w-0 flex-1">
          <div class="truncate font-mono text-[13.5px] font-bold">{a.name}</div>
          <div class="text-[12px] text-muted">{a.serves}</div>
        </div>
        <Icon name="arrowRight" size={14} class="text-faint transition-colors group-hover:text-ink" />
      </div>
      <p class="mt-3 mb-4 line-clamp-3 text-[13px] leading-relaxed text-muted">{a.summary}</p>
      <div class="mt-auto grid grid-cols-4 gap-2 border-t border-line pt-3">
        <Stat label="in flight" value={String(inFlight)} />
        <Stat label="success" value={pct(a.stats.success)} tone={a.stats.success >= 0.95 ? "done" : undefined} />
        <Stat label="HIL rate" value={pct(a.stats.hilRate)} tone={a.stats.hilRate >= 0.3 ? "amber" : undefined} />
        <Stat label="median" value={usd(a.stats.medianCostUsd)} />
      </div>
      <div class="mt-2.5 font-mono text-[11px] text-faint">{a.model}</div>
    </a>
  );
}

// ───────────────────────────── detail ─────────────────────────────

function definitionYaml(a: Agent): string {
  const toolLines = a.tools.map((t) => `      - ${t}`).join("\n");
  const skillLines = a.skills.map((s) => `      - ref: ghcr.io/${TENANT.org}/ktiro-agents/skills/${s}:v${(s.length % 9) + 4}`).join("\n");
  return `apiVersion: kagent.dev/v1alpha2
kind: Agent
metadata:
  name: ${a.name}
  namespace: ktiro-${TENANT.org}
  labels:
    ktiro.dev/serves: ${a.serves.toLowerCase().replace(/[^a-z]+/g, "-")}
spec:
  type: Declarative
  description: >-
    ${a.summary.replace(/\n/g, " ")}
  declarative:
    modelConfig: ${a.model}
    systemMessageFrom:
      type: ConfigMap
      name: ${a.name}
      key: system.md
    tools:
${toolLines}
    skills:
${skillLines}
    a2aConfig:
      skills:
        - id: ask-for-help
          description: Stop and raise a HIL interaction at a decision branch or below the confidence floor.`;
}

function AgentDetail({ a }: { a: Agent }) {
  const intents = useStore((s) => s.intents);
  const working = workingOn(a.id, intents);
  return (
    <div>
      <a href="#/agents" class="inline-flex items-center gap-1.5 text-[13px] text-muted no-underline hover:text-fg">
        <Icon name="arrowLeft" size={14} /> Agents
      </a>
      <div class="mt-3 flex flex-wrap items-start gap-4">
        <AgentAvatar id={a.id} size={48} />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="m-0 font-mono text-[24px] leading-tight font-bold tracking-[-0.01em]">{a.name}</h1>
            <span class="k-pill k-pill--accent">{a.serves}</span>
            <span class="k-pill k-pill--neutral">{a.model}</span>
          </div>
          <p class="mt-2 mb-0 max-w-[76ch] text-[14.5px] leading-relaxed">{a.summary}</p>
        </div>
      </div>

      <div class="k-card mt-5 grid grid-cols-2 sm:grid-cols-5">
        <div class="k-stat">
          <strong>{working.length}</strong>
          <span>in flight now</span>
        </div>
        <div class="k-stat">
          <strong>{a.stats.runs30d}</strong>
          <span>runs, 30 days</span>
        </div>
        <div class="k-stat">
          <strong>{pct(a.stats.success)}</strong>
          <span>succeeded</span>
        </div>
        <div class="k-stat">
          <strong style={a.stats.hilRate >= 0.3 ? { color: "var(--k-amber)" } : undefined}>{pct(a.stats.hilRate)}</strong>
          <span>runs that asked a person</span>
        </div>
        <div class="k-stat">
          <strong>{usd(a.stats.medianCostUsd)}</strong>
          <span>median cost per run</span>
        </div>
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div class="flex min-w-0 flex-col gap-5">
          <section class="k-card overflow-hidden">
            <div class="flex items-center gap-2 border-b border-line px-4 py-3">
              <Icon name="sparkles" size={15} class="text-ink" />
              <h2 class="k-heading !text-[14px]">Skills</h2>
              <span class="text-[12.5px] text-muted">One SKILL.md each, versioned with the agent</span>
            </div>
            <ul class="m-0 list-none p-0">
              {a.skills.map((s) => (
                <li key={s} class="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                  <Icon name="fileText" size={13} class="flex-none text-muted" />
                  <span class="font-mono text-[13px]">{s}</span>
                  <span class="ml-auto hidden font-mono text-[11.5px] text-faint sm:inline">ktiro-agents/skills/{s}/SKILL.md</span>
                </li>
              ))}
            </ul>
          </section>

          <section class="k-card overflow-hidden">
            <div class="flex items-center gap-2 border-b border-line px-4 py-3">
              <Icon name="terminal" size={15} class="text-ink" />
              <h2 class="k-heading !text-[14px]">Definition</h2>
              <span class="k-mono-tag ml-auto !text-[11px]">{a.definition}</span>
            </div>
            <pre class="m-0 overflow-x-auto bg-code px-4 py-3 font-mono text-[12px] leading-relaxed text-fg">{definitionYaml(a)}</pre>
            <p class="m-0 border-t border-line px-4 py-2.5 text-[12px] text-faint">Illustrative. Agents hold no credentials; model traffic goes through the egress broker.</p>
          </section>
        </div>

        <aside class="flex min-w-0 flex-col gap-4">
          <div class="k-card k-card--pad">
            <h3 class="k-heading !text-[14px]">Tools</h3>
            <ul class="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
              {a.tools.map((t) => (
                <li key={t} class="flex items-center gap-2 text-[13px]">
                  <Icon name="box" size={13} class="text-muted" />
                  <span class="font-mono">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div class="k-card k-card--pad">
            <h3 class="k-heading !text-[14px]">{a.id === "process" ? "Its intents in flight" : "Working on now"}</h3>
            {working.length === 0 ? (
              <p class="mt-2 mb-0 text-[13px] text-muted">Nothing in flight.</p>
            ) : (
              <ul class="m-0 mt-2 list-none p-0">
                {working.slice(0, 12).map((i) => (
                  <li key={i.id} class="border-t border-line py-2 first:border-t-0">
                    <a href={hrefIntent(i.id)} class="block text-fg no-underline hover:text-ink">
                      <div class="flex items-center gap-2 text-[13px]">
                        <span class="font-mono text-[11.5px] text-faint">{i.id}</span>
                        <span class="min-w-0 flex-1 truncate">{i.title}</span>
                        <KindPill kind={i.kind} compact />
                      </div>
                      <div class="mt-1 flex items-center gap-2">
                        <MiniRail intent={i} />
                        <span class="truncate text-[11.5px] text-muted">{PHASE_LABEL[i.phase]}</span>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {a.id === "security" ? <FindingsCard /> : null}
        </aside>
      </div>

      {a.id === "process" ? <ProcessSection detail /> : null}
    </div>
  );
}

// ───────────────────────────── security: findings ─────────────────────────────

const SOURCE_LABEL: Record<NonNullable<Intent["finding"]>["source"], string> = {
  "github-code-scanning": "CodeQL",
  wiz: "Wiz",
  "google-scc": "Security Command Center",
  generic: "generic",
};

/**
 * patchy's findings, as the security agent sees them: scanner alerts are
 * accumulated into one finding, investigated, and anything worth remediating
 * becomes a security intent, which outranks every other kind.
 */
function FindingsCard() {
  const intents = useStore((s) => s.intents);
  const raised = intents.filter((i) => i.finding).sort((x, y) => y.createdAt - x.createdAt);
  return (
    <div class="k-card k-card--pad">
      <h3 class="k-heading !text-[14px]">Raised from patchy findings</h3>
      <p class="mt-1.5 mb-0 text-[12.5px] leading-relaxed text-muted">
        Scanner alerts accumulate into one finding; investigation decides whether it is real. Real ones become security intents and go to the head of the queue.
      </p>
      <ul class="m-0 mt-2 list-none p-0">
        {raised.map((i) => (
          <li key={i.id} class="border-t border-line py-2 first:border-t-0">
            <a href={hrefIntent(i.id)} class="block text-fg no-underline hover:text-ink">
              <div class="flex items-center gap-2 text-[13px]">
                <span class="font-mono text-[11.5px] text-faint">{i.id}</span>
                <span class="min-w-0 flex-1 truncate">{i.title}</span>
              </div>
              <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted">
                <span>{i.finding!.id}</span>
                <span class="text-faint">·</span>
                <span>
                  {SOURCE_LABEL[i.finding!.source]} · {i.finding!.alerts} alert{i.finding!.alerts === 1 ? "" : "s"}
                </span>
                <span class="text-faint">·</span>
                <span>{PHASE_LABEL[i.phase]}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────────── process agent ─────────────────────────────

const LOOP: { icon: IconName; title: string; text: string }[] = [
  { icon: "hand", title: "A person is needed", text: "An agent stops in engineering, technical review or business review: a decision branch, a wall, a net-new ADR, or a gate." },
  { icon: "wand", title: "Friction is clustered", text: "The process agent reads every HIL record in ktiro-intents and groups them by cause." },
  { icon: "lightbulb", title: "A fix is proposed", text: "A change to a skill, the toolchain or a reusable workflow: the tools the other agents use." },
  { icon: "trendingUp", title: "It ships as an intent", text: "Accepted proposals become intents with an outcome: the HIL rate for that cause must fall." },
];

const TARGET_ICON: Record<Proposal["target"], IconName> = {
  "ktiro-agents": "bot",
  toolchain: "settings",
  "github-workflows": "refresh",
};

function ProcessSection({ detail }: { detail?: boolean }) {
  const total = (m: (typeof HIL_TREND)[number]) => m.engineering + m.technical + m.business;
  const max = Math.max(...HIL_TREND.map(total));
  const first = HIL_TREND[0];
  const last = HIL_TREND[HIL_TREND.length - 1];
  const drop = 1 - total(last) / total(first);
  return (
    <section class="mt-10" aria-labelledby="proposals">
      <div class="flex flex-wrap items-center gap-2">
        <AgentAvatar id="process" size={26} />
        <h2 id="proposals" class="k-heading !text-[18px]">
          Proposals from HIL friction
        </h2>
        {!detail ? (
          <a href="#/agents/process" class="ml-auto text-[13px] font-semibold text-ink no-underline hover:underline">
            process-agent <Icon name="arrowRight" size={12} class="inline" />
          </a>
        ) : null}
      </div>
      <p class="mt-1.5 mb-0 max-w-[80ch] text-[14px] text-muted">
        Every time a person is pulled into engineering, technical review or business review is evidence that a tool could have known better. The process agent turns repeated friction into changes to
        the factory itself, so the same question is not asked twice.
      </p>

      <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <ol class="m-0 grid list-none gap-px overflow-hidden rounded-[10px] border border-line bg-line p-0 sm:grid-cols-2 xl:grid-cols-4">
          {LOOP.map((s, k) => (
            <li key={s.title} class="bg-surface p-4">
              <div class="flex items-center gap-2">
                <span class="grid size-7 place-items-center rounded-full bg-surface-2 text-ink">
                  <Icon name={s.icon} size={14} />
                </span>
                <span class="font-mono text-[11px] text-faint">{k + 1}</span>
              </div>
              <div class="mt-2.5 text-[13.5px] font-semibold">{s.title}</div>
              <p class="mt-1 mb-0 text-[12.5px] leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
        <div class="k-card k-card--pad">
          <div class="flex items-baseline justify-between">
            <h3 class="k-heading !text-[14px]">HIL interactions per month</h3>
            <span class="font-mono text-[12px] text-done">−{pct(drop)}</span>
          </div>
          <div class="mt-3 flex h-[92px] items-end gap-2" role="img" aria-label={`HIL interactions fell from ${total(first)} in ${first.month} to ${total(last)} in ${last.month}`}>
            {HIL_TREND.map((m) => (
              <div key={m.month} class="flex flex-1 flex-col items-center gap-1" title={`${m.month}: ${m.engineering} engineering, ${m.technical} technical review, ${m.business} business review`}>
                <div class="flex w-full flex-col justify-end gap-[2px]" style={{ height: "72px" }}>
                  <span class="block w-full rounded-t-[3px] bg-amber" style={{ height: `${(m.business / max) * 72}px`, opacity: 0.4 }} />
                  <span class="block w-full bg-amber" style={{ height: `${(m.technical / max) * 72}px`, opacity: 0.7 }} />
                  <span class="block w-full rounded-b-[3px] bg-amber" style={{ height: `${(m.engineering / max) * 72}px` }} />
                </div>
                <span class="font-mono text-[10.5px] text-faint">{m.month}</span>
              </div>
            ))}
          </div>
          <div class="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted">
            <span class="flex items-center gap-1.5">
              <span class="k-swatch bg-amber" /> engineering
            </span>
            <span class="flex items-center gap-1.5">
              <span class="k-swatch bg-amber opacity-70" /> technical
            </span>
            <span class="flex items-center gap-1.5">
              <span class="k-swatch bg-amber opacity-40" /> business
            </span>
          </div>
        </div>
      </div>

      <div class="mt-4 flex flex-col gap-3">
        {PROPOSALS.map((p) => (
          <ProposalCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}

function ProposalCard({ p }: { p: Proposal }) {
  const [raised, setRaised] = useState(false);
  const status = raised ? "raised" : p.status;
  return (
    <article class="k-card overflow-hidden">
      <div class="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_230px]">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="k-mono-tag">
              <Icon name={TARGET_ICON[p.target]} size={12} /> {p.target}
            </span>
            {status === "intent" && p.intent ? (
              <a href={hrefIntent(p.intent)} class="k-pill k-pill--accent no-underline">
                became intent {p.intent}
              </a>
            ) : status === "shipped" ? (
              <span class="k-pill k-pill--done">
                <Icon name="check" size={11} /> shipped
              </span>
            ) : status === "raised" ? (
              <span class="k-pill k-pill--accent">raised as an intent</span>
            ) : (
              <span class="k-pill k-pill--neutral">proposed</span>
            )}
          </div>
          <h3 class="mt-2 mb-0 text-[15px] leading-snug font-bold">{p.title}</h3>
          <p class="mt-1.5 mb-0 text-[13px] leading-relaxed text-muted">
            <span class="font-semibold text-amber">Friction:</span> {p.friction.summary}
          </p>
          <div class="mt-2 text-[13px] leading-relaxed">
            <span class="font-semibold">Change:</span> <Markdown src={p.change} class="inline !text-[13px] [&>p]:inline" />
          </div>
          <div class="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
            Seen in
            {p.friction.examples.map((id) => (
              <a key={id} href={hrefIntent(id)} class="k-mono-tag !text-[11px]">
                {id}
              </a>
            ))}
          </div>
        </div>
        <div class="flex flex-col gap-3 border-line md:border-l md:pl-4">
          <dl class="m-0 grid grid-cols-2 gap-x-4 gap-y-2 [&_dt]:text-[12px] [&_dt]:text-muted [&_dd]:m-0 [&_dd]:text-[14px]">
            <div>
              <dt>HIL interactions</dt>
              <dd class="font-mono font-bold text-amber">{p.friction.hilCount}</dd>
            </div>
            <div>
              <dt>median wait</dt>
              <dd class="font-mono">{p.friction.medianWaitH}h</dd>
            </div>
            <div>
              <dt>phases</dt>
              <dd class="text-[13px]">{p.friction.phases.map((ph) => PHASE_LABEL[ph].toLowerCase()).join(", ")}</dd>
            </div>
            <div>
              <dt>expected</dt>
              <dd class="font-mono text-done">−{p.expectedHilReduction}/mo</dd>
            </div>
          </dl>
          {p.status === "proposed" ? (
            <button
              type="button"
              class={`k-btn k-btn--sm mt-auto ${raised ? "" : "k-btn--primary"}`}
              disabled={raised}
              onClick={() => {
                setRaised(true);
                toast(`Proposal raised as an intent against ${p.target}`, "done");
              }}
            >
              <Icon name={raised ? "check" : "plus"} size={13} /> {raised ? "Raised" : "Raise as intent"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
