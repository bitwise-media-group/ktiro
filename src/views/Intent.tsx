/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// One intent, end to end. The header and phase rail answer "where is it and
// what does it need?"; the tabs progressively disclose the request and its
// outcome, the conversation, the plan, the merge set, the blind reviews, the
// canary, and the record (time, cost and the git files behind it all).

import { useState } from "preact/hooks";
import { agent, person, REPOS } from "../data/org";
import { AgentAvatar, PersonAvatar } from "../components/Avatar";
import { EvidenceStrip } from "../components/Evidence";
import { Icon, type IconName } from "../components/icons";
import { Markdown } from "../components/Markdown";
import { GateRow, PhaseRail } from "../components/PhaseRail";
import { KindPill, StatusPill, ValueTag } from "../components/Pills";
import { Assignees, GateCard, Thread } from "../components/Thread";
import { ago, hours, KIND_LABEL, money, PHASE_LABEL, PHASE_SHORT, pct, sum, usd } from "../format";
import { blockedBy, rankAll } from "../priority";
import { hrefIntent, INTENT_TABS, type IntentTab } from "../router";
import { fastForwardCanary, now, useIntent, useStore } from "../store";
import type { AdrProposal, Card, Criterion, Intent, Message, PullRequest, Verdict } from "../types";

const TAB_LABEL: Record<IntentTab, string> = {
  overview: "Overview",
  conversation: "Conversation",
  plan: "Plan",
  changes: "Changes",
  technical: "Technical review",
  business: "Business review",
  operate: "Operate",
  record: "Record",
};

function openGate(i: Intent) {
  return i.messages.find((m) => m.card?.type === "gate" && !m.card.decision) as (Message & { card: Extract<Card, { type: "gate" }> }) | undefined;
}
function openQuestion(i: Intent) {
  return i.messages.find((m) => m.card?.type === "question" && !m.card.answer) as (Message & { card: Extract<Card, { type: "question" }> }) | undefined;
}

export function IntentView({ id, tab }: { id: string; tab: IntentTab }) {
  const intent = useIntent(id);
  const all = useStore((s) => s.intents);
  if (!intent) {
    return (
      <div class="k-card k-card--pad">
        No intent {id}. <a href="#/backlog">Back to the backlog</a>
      </div>
    );
  }
  const rank = rankAll(all).findIndex((x) => x.id === id) + 1;
  const spent = sum(intent.phases.map((p) => p.costUsd));
  const age = ((intent.phase === "done" ? intent.phases.at(-1)?.exitedAt ?? now() : now()) - intent.createdAt) / 3_600_000;
  const q = openQuestion(intent);
  const g = openGate(intent);
  const ask = q ?? g;
  const askees = ask ? (ask.card.assigned.map((a) => person(a.person).name.split(" ")[0]).join(", ")) : "";

  const counts: Partial<Record<IntentTab, number>> = {
    conversation: intent.messages.filter((m) => m.from.kind !== "system").length,
    changes: intent.prs?.length,
  };
  const disabled: Partial<Record<IntentTab, boolean>> = {
    plan: !intent.plan,
    changes: !intent.prs?.length,
    technical: !intent.verdicts,
    business: !intent.canary || !!intent.fastPath,
    operate: !intent.canary || intent.canary.exposure.step < 0,
  };

  return (
    <div>
      <a href="#/backlog" class="inline-flex items-center gap-1.5 text-[13px] text-muted no-underline hover:text-fg">
        <Icon name="arrowLeft" size={14} /> Backlog
      </a>

      {/* ── Header ── */}
      <div class="mt-3 flex flex-wrap items-start gap-x-6 gap-y-3">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="k-mono-tag">{intent.id}</span>
            <KindPill kind={intent.kind} />
            <StatusPill intent={intent} />
            {intent.origin ? (
              <span class="k-pill k-pill--neutral">
                <Icon name="bot" size={11} /> raised by {agent(intent.origin).name}
              </span>
            ) : null}
            {intent.finding ? (
              <span class="k-pill k-pill--sec" title={`patchy finding: ${intent.finding.rule} · ${intent.finding.alerts} alert${intent.finding.alerts === 1 ? "" : "s"} accumulated`}>
                <Icon name="search" size={11} /> finding {intent.finding.id}
              </span>
            ) : null}
            {intent.fastPath ? (
              <a href={hrefIntent(intent.fastPath.parent, "operate")} class="k-pill k-pill--accent no-underline" title={intent.fastPath.reason}>
                <Icon name="zap" size={11} /> fast path · completes {intent.fastPath.parent}
              </a>
            ) : null}
          </div>
          <h1 class="mt-2 mb-0 text-[24px] leading-tight font-bold tracking-[-0.01em] text-balance">{intent.title}</h1>
          <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted">
            <span class="inline-flex items-center gap-1.5">
              <PersonAvatar id={intent.author} size={18} /> {person(intent.author).name} · {ago(intent.createdAt)}
            </span>
            <span class="inline-flex items-center gap-1.5">
              <AgentAvatar id="orchestrator" size={18} /> orchestrator owns it
            </span>
            <span class="font-mono text-[12px]">{intent.statusText}</span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <ValueTag amount={intent.value.amount} observed={intent.canary?.valueObserved || undefined} />
          {intent.phase !== "done" ? (
            <span class="k-pill k-pill--neutral" title="Position in pull order: criticality, then value, then importance">
              #{rank} in pull order
            </span>
          ) : null}
          <span class="k-pill k-pill--neutral" title="Time in the system and spend so far">
            <Icon name="clock" size={12} /> {hours(age)} · {usd(spent)}
          </span>
        </div>
      </div>

      {/* ── Phase rail ── */}
      <div class="k-card mt-5 overflow-x-auto px-5 pt-11 pb-4"><div class="min-w-[780px] pr-4">
        <PhaseRail intent={intent} />
        </div>
      </div>

      {ask ? (
        <div class="k-note mt-4 items-center">
          <Icon name={q ? "messageQuestion" : "hand"} size={16} class="flex-none" />
          <span class="min-w-0 flex-1 text-fg">
            <strong class="text-amber">{q ? "An agent stopped to ask:" : "Waiting at a gate:"}</strong> {q ? q.card.question.prompt : g!.card.gate}
            <span class="text-muted"> · asked of {askees}</span>
          </span>
          <a href={hrefIntent(intent.id, "conversation")} class="k-btn k-btn--sm !border-amber !text-amber no-underline">
            {q ? "Answer" : "Decide"} <Icon name="arrowRight" size={13} />
          </a>
        </div>
      ) : null}

      {/* ── Tabs ── */}
      <nav class="k-tabs mt-6" aria-label="Intent sections">
        {INTENT_TABS.map((t) =>
          disabled[t] ? (
            <span key={t} class="-mb-px inline-flex items-center px-0.5 py-3 text-[14px] font-semibold whitespace-nowrap text-faint opacity-60" title="Not reached yet">
              {TAB_LABEL[t]}
            </span>
          ) : (
            <a key={t} href={hrefIntent(intent.id, t)} class={tab === t ? "is-active" : ""} aria-current={tab === t ? "page" : undefined}>
              {TAB_LABEL[t]}
              {counts[t] ? <span class="k-count">{counts[t]}</span> : null}
              {t === "conversation" && ask ? <span class="k-live-dot k-live-dot--amber !size-[6px]" /> : null}
            </a>
          ),
        )}
      </nav>

      <div class="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="min-w-0">
          {tab === "overview" ? <Overview intent={intent} /> : null}
          {tab === "conversation" ? <Thread intent={intent} /> : null}
          {tab === "plan" ? <PlanTab intent={intent} /> : null}
          {tab === "changes" ? <ChangesTab intent={intent} /> : null}
          {tab === "technical" ? <TechnicalTab intent={intent} /> : null}
          {tab === "business" ? <BusinessTab intent={intent} /> : null}
          {tab === "operate" ? <OperateTab intent={intent} all={all} /> : null}
          {tab === "record" ? <RecordTab intent={intent} /> : null}
        </div>
        <Sidebar intent={intent} all={all} />
      </div>
    </div>
  );
}

// ───────────────────────────── Overview ─────────────────────────────

const CHECK_ICON: Record<Criterion["check"], IconName> = {
  grader: "target",
  tests: "check",
  canary: "flag",
  benchmark: "gauge",
  human: "user",
};

export function OutcomeRubric({ intent }: { intent: Intent }) {
  const passing = intent.outcome.filter((c) => c.status === "passing").length;
  return (
    <section class="k-card overflow-hidden">
      <div class="flex items-center gap-3 border-b border-line px-4 py-3">
        <Icon name="target" size={16} class="text-ink" />
        <h2 class="k-heading">Outcome</h2>
        <span class="text-[12.5px] text-muted">How we'll know it's done · graded, not opinion</span>
        <span class="ml-auto font-mono text-[12px] text-muted">
          {passing}/{intent.outcome.length} passing
        </span>
      </div>
      <ul class="m-0 list-none p-0">
        {intent.outcome.map((c, k) => (
          <li key={k} class="flex items-start gap-3 border-t border-line px-4 py-3 first:border-t-0">
            <span
              class={`mt-px grid size-5 flex-none place-items-center rounded-full ${c.status === "passing" ? "bg-done text-onaccent" : c.status === "failing" ? "bg-red text-onaccent" : "border border-dashed border-line-3 text-faint"}`}
            >
              {c.status === "passing" ? <Icon name="check" size={12} strokeWidth={2.8} /> : c.status === "failing" ? <Icon name="x" size={12} strokeWidth={2.8} /> : null}
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-[14px] leading-snug">{c.text}</div>
              {c.evidence ? <div class="mt-0.5 font-mono text-[11.5px] text-muted">{c.evidence}</div> : null}
            </div>
            <span class="k-pill k-pill--neutral !text-[11px]" title={`Checked by: ${c.check}`}>
              <Icon name={CHECK_ICON[c.check]} size={11} /> {c.check}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Overview({ intent }: { intent: Intent }) {
  const fit = intent.sizing.contextFit;
  return (
    <div class="flex flex-col gap-5">
      <section>
        <h2 class="k-heading">What should change, and why?</h2>
        <Markdown src={intent.request} class="mt-2 max-w-[72ch] text-[14.5px]" />
      </section>
      <OutcomeRubric intent={intent} />
      <div class="grid gap-4 md:grid-cols-3">
        <div class="k-card k-card--pad">
          <div class="flex items-center gap-2">
            <KindPill kind={intent.kind} />
            <span class="k-label">criticality</span>
          </div>
          <p class="mt-2.5 mb-0 text-[13px] leading-relaxed">{intent.kindReason || `Classified as ${KIND_LABEL[intent.kind].toLowerCase()}.`}</p>
          <p class="mt-2 mb-0 flex items-center gap-1.5 text-[12px] text-faint">
            <AgentAvatar id="definer" size={16} /> Set by definer-agent. People can dispute it, not set it.
          </p>
        </div>
        <div class="k-card k-card--pad">
          <div class="flex items-baseline justify-between">
            <span class="font-mono text-[20px] font-bold">{money(intent.value.amount, { sign: true })}</span>
            <span class="k-label">ARR impact / yr</span>
          </div>
          <p class="mt-2 mb-0 text-[13px] leading-relaxed text-muted">{intent.value.basis || "Estimated by the definer agent."}</p>
          <div class="mt-2.5 flex items-center gap-2 text-[12px] text-faint">
            confidence
            <span class="k-track flex-1">
              <span style={{ width: pct(intent.value.confidence) }} />
            </span>
            {pct(intent.value.confidence)}
          </div>
        </div>
        <div class="k-card k-card--pad">
          <div class="flex items-baseline justify-between">
            <span class="font-mono text-[20px] font-bold">{intent.sizing.estTurns}</span>
            <span class="k-label">est. agent turns</span>
          </div>
          <p class="mt-2 mb-0 text-[13px] leading-relaxed text-muted">One orchestrator owns this end to end, inside a single context window.</p>
          <div class="mt-2.5 flex items-center gap-2 text-[12px] text-faint">
            context fit
            <span class="k-track flex-1">
              <span style={{ width: pct(Math.min(1, fit)), background: fit > 0.75 ? "var(--k-amber)" : undefined }} />
            </span>
            {pct(fit)}
          </div>
        </div>
      </div>
      {intent.outOfScope?.length ? (
        <section>
          <h2 class="k-heading">Out of scope</h2>
          <ul class="mt-2 text-[14px]">
            {intent.outOfScope.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

// ───────────────────────────── Plan ─────────────────────────────

function PlanTab({ intent }: { intent: Intent }) {
  const plan = intent.plan;
  if (!plan) return <Empty icon="layers" text="Planning hasn't produced a plan yet." />;
  const g = intent.gates.find((x) => x.to === "engineering")!;
  const gateMsg = intent.messages.find((m) => m.card?.type === "gate" && m.card.gate === "Plan approved") as (Message & { card: Extract<Card, { type: "gate" }> }) | undefined;
  return (
    <div class="flex flex-col gap-5">
      <section>
        <div class="flex items-center gap-2">
          <AgentAvatar id="planner" size={22} />
          <h2 class="k-heading">The plan</h2>
          <span class="k-mono-tag ml-auto !text-[11px]">
            ktiro-intents/intents/{intent.id}-{intent.slug}/plan.md
          </span>
        </div>
        <p class="mt-2 mb-0 max-w-[72ch] text-[14.5px] leading-relaxed">{plan.summary}</p>
      </section>
      <ol class="m-0 flex list-none flex-col gap-0 p-0">
        {plan.steps.map((s, k) => (
          <li key={s.repo} class="k-tl__item">
            <span class="k-tl__marker font-mono text-[11px] font-bold">{k + 1}</span>
            <div class="k-card min-w-0 flex-1 p-4">
              <div class="flex flex-wrap items-center gap-2">
                <span class="k-mono-tag">
                  <Icon name="folder" size={12} /> {s.repo}
                </span>
                <strong class="text-[14px]">{s.summary}</strong>
                {REPOS.find((r) => r.name === s.repo)?.customerFacing ? <span class="k-pill k-pill--feat !text-[11px]">customer-facing</span> : null}
                <span class="ml-auto font-mono text-[11.5px] text-muted">~{s.estTurns} turns</span>
              </div>
              <ul class="mt-2.5 mb-0 pl-5 text-[13.5px] leading-relaxed">
                {s.changes.map((c) => (
                  <li key={c}>
                    <Markdown src={c} class="!text-[13.5px] [&>p]:m-0" />
                  </li>
                ))}
              </ul>
              {s.dependsOn?.length ? <div class="mt-2 font-mono text-[11.5px] text-faint">builds on {s.dependsOn.join(", ")}</div> : null}
            </div>
          </li>
        ))}
      </ol>
      <section class="k-card k-card--pad">
        <h3 class="k-heading !text-[14px]">Risks the planner named</h3>
        <ul class="mt-2 mb-0 pl-5 text-[13.5px] leading-relaxed">
          {plan.risks.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
      <div class="k-note k-note--accent">
        <Icon name="gitMerge" size={16} class="mt-0.5 flex-none" />
        <span class="text-fg">
          The steps are ordered for building, not merging. Every pull request stays open until the whole set has passed review; then ktiro merges all {plan.steps.length} together in the merge lane.
        </span>
      </div>
      {(intent.adrProposals ?? []).filter((p) => p.kind === "change").map((p) => (
        <AdrProposalCard key={p.id} intent={intent} p={p} />
      ))}
      {gateMsg ? <GateCard intent={intent} msg={gateMsg} card={gateMsg.card} /> : <GateRow gate={g} />}
    </div>
  );
}

// ───────────────────────────── Changes ─────────────────────────────

const PR_STATE: Record<PullRequest["state"], [string, string]> = {
  draft: ["draft", "k-pill--neutral"],
  open: ["in review", "k-pill--accent"],
  ready: ["ready", "k-pill--done"],
  merging: ["merging", "k-pill--accent"],
  merged: ["merged", "k-pill--done"],
};

function Tick({ ok, label }: { ok: boolean | "pending"; label: string }) {
  return (
    <span class={`inline-flex items-center gap-1 text-[12px] ${ok === true ? "text-done" : ok === "pending" ? "text-muted" : "text-amber"}`}>
      <Icon name={ok === true ? "check" : ok === "pending" ? "clock" : "alertTriangle"} size={12} strokeWidth={2.4} />
      {label}
    </span>
  );
}

function ChangesTab({ intent }: { intent: Intent }) {
  const prs = intent.prs ?? [];
  const [showCode, setShowCode] = useState<string | null>(null);
  const ready = prs.filter((p) => p.state === "ready" || p.state === "merged").length;
  const merged = prs.filter((p) => p.state === "merged").length;
  if (!prs.length) return <Empty icon="gitPullRequest" text="No changes yet." />;
  return (
    <div class="flex flex-col gap-4">
      <section class="k-card overflow-hidden">
        <div class="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <Icon name="gitMerge" size={16} class="text-ink" />
          <h2 class="k-heading">Merge set</h2>
          <span class="text-[12.5px] text-muted">
            {prs.length} repositor{prs.length === 1 ? "y" : "ies"} · reviewed as one · merged together by ktiro
          </span>
          <span class="ml-auto font-mono text-[12px] text-muted">{merged === prs.length ? `${merged}/${prs.length} merged` : `${ready}/${prs.length} ready`}</span>
        </div>
        <div class="px-4 py-3">
          <div class="flex gap-1">
            {prs.map((p) => (
              <span
                key={p.repo}
                class="h-2 flex-1 rounded-full transition-colors duration-500"
                style={{ background: p.state === "merged" ? "var(--k-done)" : p.state === "ready" ? "color-mix(in oklab, var(--k-done) 45%, var(--k-line))" : p.state === "merging" ? "var(--k-accent)" : "var(--k-line-2)" }}
              />
            ))}
          </div>
          <p class="mt-2 mb-0 text-[12.5px] text-muted">
            Nothing merges until every pull request is open, green and approved. No person can push or merge; ktiro is the only writer.
          </p>
        </div>
        <ul class="m-0 list-none border-t border-line p-0">
          {prs.map((p) => (
            <li key={p.repo} class="border-t border-line first:border-t-0">
              <div class="grid gap-3 px-4 py-3.5 md:grid-cols-[minmax(0,1fr)_auto]">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="k-mono-tag">
                      <Icon name="gitPullRequest" size={12} /> {p.repo}#{p.number}
                    </span>
                    <span class={`k-pill ${PR_STATE[p.state][1]}`}>{PR_STATE[p.state][0]}</span>
                    <span class="font-mono text-[12px]">
                      <span class="text-done">+{p.additions}</span> <span class="text-red">−{p.deletions}</span>
                      <span class="text-faint"> · {p.files} files</span>
                    </span>
                  </div>
                  <div class="mt-1.5 text-[14px] font-semibold">{p.title}</div>
                  <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    <Tick ok={p.checks === "passing" ? true : p.checks === "running" ? "pending" : false} label={`checks ${p.checks}`} />
                    <Tick ok={p.tests > 0} label={`${p.tests} tests`} />
                    <Tick ok={p.docs} label="docs site" />
                    {p.benchmark ? <Tick ok label={p.benchmark} /> : null}
                    <Tick ok={p.review === "approved" ? true : p.review === "pending" ? "pending" : false} label={`review ${p.review}`} />
                    <Tick ok={p.security === "approved" ? true : p.security === "pending" ? "pending" : false} label={`security ${p.security}`} />
                  </div>
                </div>
                <div class="flex items-start">
                  <button type="button" class="k-btn k-btn--ghost k-btn--sm" onClick={() => setShowCode(showCode === p.repo ? null : p.repo)}>
                    <Icon name="terminal" size={13} /> {showCode === p.repo ? "Hide code" : "Show code"}
                  </button>
                </div>
              </div>
              {showCode === p.repo ? <FauxDiff pr={p} /> : null}
            </li>
          ))}
        </ul>
      </section>
      <div class="k-note k-note--accent">
        <Icon name="eye" size={16} class="mt-0.5 flex-none" />
        <span class="text-fg">
          You review the results of the intent, not the code. The code is here if you want to go deeper, or if an agent flags a concern.
        </span>
      </div>
    </div>
  );
}

function FauxDiff({ pr }: { pr: PullRequest }) {
  const lines: [string, string][] = [
    [" ", `// ${pr.repo}: ${pr.title}`],
    ["-", "func handle(ctx context.Context, d Delivery) error {"],
    ["+", "func handle(ctx context.Context, d Delivery) (Result, error) {"],
    ["+", "\tif seen, err := s.dedupe.Seen(ctx, d.Key()); err != nil || seen {"],
    ["+", "\t\treturn Duplicate, err"],
    ["+", "\t}"],
    [" ", "\treturn s.ledger.Post(ctx, d.Entry())"],
    [" ", "}"],
  ];
  return (
    <pre class="m-0 overflow-x-auto border-t border-line bg-code px-4 py-3 font-mono text-[12px] leading-relaxed">
      {lines.map(([k, l], i) => (
        <div key={i} class={k === "+" ? "bg-[color-mix(in_oklab,var(--k-done)_12%,transparent)] text-done" : k === "-" ? "bg-[color-mix(in_oklab,var(--k-red)_10%,transparent)] text-red" : "text-muted"}>
          {k} {l}
        </div>
      ))}
      <div class="mt-2 text-faint">… illustrative excerpt · full diff in the forge, read-only</div>
    </pre>
  );
}

// ───────────────────────────── Review ─────────────────────────────

function VerdictCard({ title, v, icon }: { title: string; v: Verdict; icon: IconName }) {
  const tone = v.verdict === "pass" ? "done" : v.verdict === "concern" ? "red" : "accent";
  return (
    <div class="k-card k-card--pad">
      <div class="flex items-center gap-2">
        <AgentAvatar id={v.agent} size={24} />
        <strong class="text-[14px]">{title}</strong>
        <span class={`k-pill k-pill--${tone} ml-auto`}>
          {v.verdict === "running" ? <span class="k-live-dot" /> : <Icon name={icon} size={12} />}
          {v.verdict}
        </span>
      </div>
      <p class="mt-2.5 mb-0 text-[13.5px] leading-relaxed">{v.summary}</p>
      {v.findings.length ? (
        <ul class="m-0 mt-2.5 list-none border-t border-line p-0 pt-2">
          {v.findings.map((f, k) => (
            <li key={k} class="flex items-start gap-2 py-1 text-[12.5px]">
              <span class={`k-pill !py-0 !text-[10.5px] ${f.severity === "high" ? "k-pill--red" : f.severity === "medium" ? "k-pill--amber" : "k-pill--neutral"}`}>{f.severity}</span>
              <span class="text-muted">{f.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AdrProposalCard({ intent, p }: { intent: Intent; p: AdrProposal }) {
  const tone = p.status === "agreed" ? "done" : p.status === "rejected" ? "neutral" : "amber";
  return (
    <div class={`k-card overflow-hidden ${p.status === "proposed" ? "border-amber" : ""}`}>
      <div class="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5">
        <Icon name="book" size={15} class={p.status === "proposed" ? "text-amber" : "text-ink"} />
        <span class="k-mono-tag !text-[11px]">{p.id}</span>
        <strong class="text-[13.5px]">{p.kind === "new" ? "Net-new ADR" : "Change to an existing ADR"}</strong>
        <span class="text-[12.5px] text-muted">{p.scope === "product" ? "product-wide · ktiro-docs" : `local · ${p.scope}`}</span>
        <span class={`k-pill k-pill--${tone} ml-auto`}>{p.status}</span>
      </div>
      <div class="p-4">
        <h3 class="m-0 text-[15px] font-bold">{p.title}</h3>
        <dl class="k-kv k-kv--stack mt-3">
          <div>
            <dt>Context</dt>
            <dd class="text-[13.5px]">{p.context}</dd>
          </div>
          <div>
            <dt>{p.kind === "new" ? "Decision" : "Proposed change"}</dt>
            <dd class="text-[13.5px]">{p.decision}</dd>
          </div>
        </dl>
        {p.burden ? (
          <div class="mt-3 rounded-lg border border-line bg-surface-2 p-3">
            <div class="k-label">Burden of proof for changing an existing ADR</div>
            <ul class="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[13px]">
              {p.burden.map((b) => (
                <li key={b.item} class="flex items-start gap-2">
                  <Icon name={b.met ? "check" : "circle"} size={13} class={`mt-0.5 flex-none ${b.met ? "text-done" : "text-amber"}`} strokeWidth={b.met ? 2.6 : 1.8} />
                  <span class={b.met ? "" : "text-muted"}>{b.item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p class="mt-3 mb-0 text-[12.5px] text-faint">
          {p.kind === "new"
            ? "Net-new ADRs are introduced in technical review and always need a person to agree."
            : "Existing ADRs can only be changed from planning, and only once every item above is met."}
          {p.status === "proposed" ? (
            <>
              {" "}
              <a href={hrefIntent(intent.id, "conversation")} class="font-semibold text-ink">
                Decide in the conversation
              </a>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function TechnicalTab({ intent }: { intent: Intent }) {
  const v = intent.verdicts;
  if (!v) return <Empty icon="eye" text="Technical review hasn't started." />;
  const proposals = (intent.adrProposals ?? []).filter((p) => p.kind === "new");
  const gate = intent.gates.find((g) => g.to === "business");
  return (
    <div class="flex flex-col gap-5">
      <div class="k-note k-note--accent">
        <Icon name="bot" size={16} class="mt-0.5 flex-none" />
        <span class="text-fg">
          Technical review belongs to agents: code review, security review and the outcome grader run in parallel, blind to each other. A person is pulled in only when an agent hits a wall, or to agree a net-new ADR.
        </span>
      </div>
      <section>
        <div class="mb-2.5 flex items-center gap-2">
          <h2 class="k-heading">Blind reviews</h2>
          <span class="text-[12.5px] text-muted">Neither sees the other's verdict until both are in</span>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <VerdictCard title="Code review" v={v.review} icon="eye" />
          <VerdictCard title="Security review" v={v.security} icon="shieldCheck" />
        </div>
      </section>
      <section class="k-card k-card--pad">
        <div class="flex items-center gap-2">
          <AgentAvatar id="orchestrator" size={24} />
          <strong class="text-[14px]">Outcome grader</strong>
          <span class="text-[12.5px] text-muted">Does the solution meet the intent?</span>
          <span class={`k-pill ml-auto ${v.outcome.verdict === "pass" ? "k-pill--done" : "k-pill--accent"}`}>
            {v.outcome.verdict === "running" ? <span class="k-live-dot" /> : null}
            {v.outcome.verdict}
          </span>
        </div>
        <p class="mt-2 mb-0 text-[13.5px]">{v.outcome.summary}</p>
        <a href={hrefIntent(intent.id)} class="mt-2 inline-block text-[12.5px] font-semibold text-ink">
          See the rubric
        </a>
      </section>
      {proposals.length ? (
        <section>
          <div class="mb-2.5 flex items-center gap-2">
            <h2 class="k-heading">Proposed decisions</h2>
            <span class="text-[12.5px] text-muted">Raised by review-agent from this change</span>
          </div>
          <div class="flex flex-col gap-3">
            {proposals.map((p) => (
              <AdrProposalCard key={p.id} intent={intent} p={p} />
            ))}
          </div>
        </section>
      ) : null}
      {intent.adrs?.length ? (
        <section class="k-card overflow-hidden">
          <div class="flex items-center gap-2 border-b border-line px-4 py-3">
            <Icon name="book" size={15} class="text-ink" />
            <h2 class="k-heading !text-[14px]">Existing ADRs checked</h2>
            <span class="text-[12.5px] text-muted">Product-wide from the knowledge base, and the repositories' own</span>
          </div>
          <table class="k-table">
            <tbody>
              {intent.adrs.map((a) => (
                <tr key={a.adr}>
                  <td class="w-[1%] whitespace-nowrap">
                    <span class="k-mono-tag !text-[11px]">{a.adr}</span>
                  </td>
                  <td>
                    {a.title}
                    {a.note ? <div class="text-[12px] text-muted">{a.note}</div> : null}
                  </td>
                  <td class="w-[1%] whitespace-nowrap text-muted">{a.scope === "product" ? "product-wide" : "local"}</td>
                  <td class="w-[1%] text-right">
                    <span class={`k-pill ${a.result === "pass" ? "k-pill--done" : "k-pill--red"}`}>{a.result}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {gate ? (
        <section class="k-card k-card--pad">
          <h2 class="k-heading !text-[14px]">Technically sound?</h2>
          <GateRow gate={gate} />
          <p class="m-0 text-[12.5px] text-muted">On a pass the whole merge set merges together and deploys dark, straight into business review.</p>
        </section>
      ) : null}
    </div>
  );
}

function BusinessTab({ intent }: { intent: Intent }) {
  const c = intent.canary;
  if (!c) return <Empty icon="eye" text="Business review starts once the merge set is deployed dark." />;
  const gateMsg = intent.messages.find((m) => m.card?.type === "gate" && m.card.gate === "Results accepted") as (Message & { card: Extract<Card, { type: "gate" }> }) | undefined;
  const live = intent.repos.find((r) => REPOS.find((x) => x.name === r)?.customerFacing);
  const liveUrl = live === "customer-portal" ? `app.ledgerline.com/?ktiro-review=${intent.id}` : live === "invoice-renderer" ? `app.ledgerline.com/invoices?ktiro-review=${intent.id}` : `api.ledgerline.com/v2 · ktiro-review=${intent.id}`;
  return (
    <div class="flex flex-col gap-5">
      <section class="k-card overflow-hidden">
        <div class="flex flex-wrap items-center gap-3 px-4 py-3.5">
          <span class="grid size-9 place-items-center rounded-lg border border-[color-mix(in_oklab,var(--k-accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--k-accent)_10%,var(--k-surface))] text-ink">
            <Icon name="globe" size={17} />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <strong class="text-[14.5px]">Live in production, behind a flag</strong>
              <span class={`k-pill ${c.exposure.status === "reviewers-only" ? "k-pill--amber" : "k-pill--done"}`}>
                <Icon name="flag" size={11} /> {c.exposure.status === "reviewers-only" ? "reviewers only" : `${c.exposure.steps[Math.max(0, c.exposure.step)]}% of customers`}
              </span>
            </div>
            <div class="mt-0.5 text-[12.5px] text-muted">
              Deployed dark through Flux and Flagger. <span class="k-mono-tag !text-[11px]">{c.exposure.flag}</span> is on for the people reviewing this intent; customers see nothing until it's accepted.
            </div>
          </div>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            class="k-btn k-btn--primary no-underline"
            title={`Demo only: would open https://${liveUrl}`}
          >
            <Icon name="externalLink" size={14} /> Open live
          </a>
        </div>
        <div class="border-t border-line bg-code-2 px-4 py-2 font-mono text-[11.5px] text-muted">https://{liveUrl}</div>
      </section>
      {intent.evidence?.length ? (
        <section>
          <div class="mb-2.5 flex items-center gap-2">
            <h2 class="k-heading">What changed for customers</h2>
            <span class="text-[12.5px] text-muted">Screenshots and recordings by review-agent, on the live deployment</span>
          </div>
          <EvidenceStrip items={intent.evidence} />
        </section>
      ) : (
        <section class="k-card k-card--pad">
          <h2 class="k-heading !text-[14px]">Nothing visual changes</h2>
          <p class="mt-1.5 mb-0 text-[13.5px] text-muted">
            The behaviour changes, so a person still accepts it, but the evidence is the run report: replay results, benchmarks and any dry runs, under <span class="k-mono-tag !text-[11px]">runs/</span> on the Record tab.
          </p>
        </section>
      )}
      <OutcomeRubric intent={intent} />
      {gateMsg ? (
        <section>
          <h2 class="k-heading">Your decision</h2>
          <p class="mt-1 mb-0 text-[13px] text-muted">You're judging the result, not the code. Accepting starts the rollout to customers at {c.exposure.steps[0]}%, measured against a control group.</p>
          <GateCard intent={intent} msg={gateMsg} card={gateMsg.card} />
        </section>
      ) : null}
    </div>
  );
}

// ───────────────────────────── Operate ─────────────────────────────

function Steps({ steps, at, done, unit }: { steps: number[]; at: number; done: boolean; unit: string }) {
  return (
    <div class="flex items-center gap-1.5">
      {steps.map((s, k) => {
        const reached = k <= at;
        const current = k === at && !done;
        return (
          <div key={s} class="flex flex-1 flex-col items-center gap-1">
            <span
              class="h-2 w-full rounded-full transition-colors duration-500"
              style={{ background: reached ? (current ? "var(--k-accent)" : "var(--k-done)") : "var(--k-line)" }}
            />
            <span class={`font-mono text-[11px] ${current ? "font-bold text-ink" : reached ? "text-fg" : "text-faint"}`}>
              {s}
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function OperateTab({ intent, all }: { intent: Intent; all: Intent[] }) {
  const c = intent.canary;
  if (!c) return <Empty icon="rocket" text="Not deployed yet." />;
  const e = c.exposure;
  const complete = intent.phase === "done";
  const removal = c.removal ? all.find((x) => x.id === c.removal!.intent) : undefined;
  return (
    <div class="flex flex-col gap-5">
      <ol class="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
        {[
          { n: 1, title: "Deployed dark", text: "At merge, before business review", ok: c.deploy.status === "promoted" },
          { n: 2, title: "Ramped to 100%", text: "Against a control group, through burn-in", ok: e.status === "complete" || complete },
          { n: 3, title: "Flag removed", text: "A fast-path intent deletes it from the code", ok: c.removal?.status === "merged" || (complete && !c.removal) },
        ].map((s) => (
          <li key={s.n} class={`k-card flex items-center gap-3 p-3.5 ${s.ok ? "" : "opacity-90"}`}>
            <span class={`grid size-7 flex-none place-items-center rounded-full font-mono text-[12px] font-bold ${s.ok ? "bg-done text-onaccent" : "border border-line-2 text-muted"}`}>
              {s.ok ? <Icon name="check" size={13} strokeWidth={2.8} /> : s.n}
            </span>
            <span class="min-w-0">
              <span class="block text-[13.5px] font-semibold">{s.title}</span>
              <span class="block text-[12px] text-muted">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p class="-mt-2 mb-0 text-[12.5px] text-muted">Done means all three: the flag at 100% and gone from the code.</p>

      <section class="k-card k-card--pad">
        <div class="flex items-center gap-2">
          <Icon name="flag" size={16} class="text-ink" />
          <h2 class="k-heading !text-[14px]">Exposure</h2>
          <span class="k-mono-tag !text-[11px]">{e.flag}</span>
          <span class={`k-pill ml-auto ${complete || e.status === "complete" ? "k-pill--done" : "k-pill--accent"}`}>{complete ? "complete" : e.status}</span>
        </div>
        <p class="mt-2 mb-3.5 text-[12.5px] text-muted">OpenFeature flag ramped across accounts as each step holds; everyone else is the control group.</p>
        <Steps steps={e.steps} at={e.step} done={e.status === "complete" || complete} unit="%" />
        <div class="mt-3.5 flex items-center gap-2 text-[12.5px]">
          <span class="text-muted">Burn-in</span>
          <span class="k-track flex-1">
            <span style={{ width: pct(e.elapsedH / e.burnInH), background: e.elapsedH >= e.burnInH ? "var(--k-done)" : undefined }} />
          </span>
          <span class="font-mono text-muted">
            {e.elapsedH}/{e.burnInH}h
          </span>
        </div>
      </section>

      <section class="k-card overflow-hidden">
        <div class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h2 class="k-heading !text-[14px]">Exposed vs control</h2>
          <span class="text-[12.5px] text-muted">Every threshold must hold for the whole burn-in</span>
        </div>
        <table class="k-table">
          <thead>
            <tr>
              <th>Signal</th>
              <th class="num">Exposed</th>
              <th class="num">Control</th>
              <th>Threshold</th>
              <th class="num" />
            </tr>
          </thead>
          <tbody>
            {c.metrics.map((m) => (
              <tr key={m.name}>
                <td>{m.name}</td>
                <td class="num">
                  {m.canary}
                  {m.unit}
                </td>
                <td class="num text-muted">{m.control ? `${m.control}${m.unit}` : "—"}</td>
                <td class="text-muted">{m.threshold}</td>
                <td class="num">
                  <span class={`k-pill ${m.ok ? "k-pill--done" : "k-pill--red"}`}>{m.ok ? "holding" : "breached"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {removal ? (
        <a href={hrefIntent(removal.id)} class="k-card k-card--hover flex flex-wrap items-center gap-3 p-4 text-fg no-underline">
          <span class="grid size-8 place-items-center rounded-lg bg-surface-2 text-ink">
            <Icon name="zap" size={16} />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13.5px] font-semibold">
              <span class="font-mono text-faint">{removal.id}</span> {removal.title}
            </span>
            <span class="block text-[12.5px] text-muted">Fast path: no functional change, so business review is skipped · {removal.statusText}</span>
          </span>
          <span class={`k-pill ${removal.phase === "done" ? "k-pill--done" : "k-pill--accent"}`}>{removal.phase === "done" ? "merged" : PHASE_LABEL[removal.phase].toLowerCase()}</span>
        </a>
      ) : null}

      <section class="k-card k-card--pad">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <div class="k-label">Value, measured on the exposed cohort</div>
            <div class="mt-1 font-mono text-[24px] font-bold text-done">{money(c.valueObserved ?? 0, { sign: true })}</div>
          </div>
          <div>
            <div class="k-label">Estimated at definition</div>
            <div class="mt-1 font-mono text-[24px] font-bold text-muted">{money(intent.value.amount, { sign: true })}</div>
          </div>
          <p class="m-0 max-w-[46ch] text-[12.5px] text-muted">
            ARR impact, scaled from the exposed cohort to full rollout. When the outcome is confirmed this becomes the intent's measured value, and the gap to the estimate feeds the definer agent's calibration.
          </p>
          {!complete && intent.phase === "operate" && e.status !== "complete" ? (
            <button type="button" class="k-btn ml-auto" onClick={() => fastForwardCanary(intent.id)}>
              <Icon name="fastForward" size={14} /> Advance burn-in 12h
              <span class="k-pill k-pill--neutral !py-0 !text-[10.5px]">demo</span>
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

// ───────────────────────────── Record ─────────────────────────────

function RecordTab({ intent }: { intent: Intent }) {
  const t = (f: (p: Intent["phases"][number]) => number) => sum(intent.phases.map(f));
  const base = `intents/${intent.id}-${intent.slug}`;
  const hil = intent.messages.filter((m) => m.card?.type === "question" || m.card?.type === "gate");
  const files = [
    { path: `${base}/intent.md`, note: "the request and the outcome rubric" },
    ...(intent.plan ? [{ path: `${base}/plan.md`, note: "the plan, as approved" }] : []),
    ...hil.map((m, k) => ({ path: `${base}/hil/${String(k + 1).padStart(3, "0")}-${m.card!.type === "question" ? "question" : "gate"}.md`, note: m.card!.type === "question" ? (m.card as Extract<Card, { type: "question" }>).question.header : (m.card as Extract<Card, { type: "gate" }>).gate })),
    ...intent.phases.map((p) => ({ path: `${base}/runs/${p.phase}.md`, note: `${PHASE_SHORT[p.phase].toLowerCase()} run report · usage` })),
    ...(intent.evidence?.length ? [{ path: `${base}/evidence/`, note: `${intent.evidence.length} recordings (blob mirror, digests in manifest)` }] : []),
  ];
  return (
    <div class="flex flex-col gap-5">
      <section class="k-card overflow-hidden">
        <div class="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon name="timer" size={15} class="text-ink" />
          <h2 class="k-heading !text-[14px]">Time and cost, by phase</h2>
          <span class="text-[12.5px] text-muted">We measure the intent's journey, not the people on it</span>
        </div>
        <div class="overflow-x-auto">
          <table class="k-table">
            <thead>
              <tr>
                <th>Phase</th>
                <th class="num">Queued</th>
                <th class="num">Agents working</th>
                <th class="num">Waiting on people</th>
                <th class="num">HIL</th>
                <th class="num">Tokens</th>
                <th class="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {intent.phases.map((p) => (
                <tr key={p.phase}>
                  <td class="font-semibold">{PHASE_LABEL[p.phase]}</td>
                  <td class="num">{hours(p.queuedH)}</td>
                  <td class="num">{hours(p.activeH)}</td>
                  <td class="num" style={p.hilH > 0 ? { color: "var(--k-amber)" } : undefined}>
                    {p.hilH ? hours(p.hilH) : "—"}
                  </td>
                  <td class="num">{p.hilCount || "—"}</td>
                  <td class="num">{p.tokensM.toFixed(1)}M</td>
                  <td class="num">{usd(p.costUsd)}</td>
                </tr>
              ))}
              <tr>
                <td class="font-bold">Total</td>
                <td class="num font-bold">{hours(t((p) => p.queuedH))}</td>
                <td class="num font-bold">{hours(t((p) => p.activeH))}</td>
                <td class="num font-bold">{hours(t((p) => p.hilH))}</td>
                <td class="num font-bold">{t((p) => p.hilCount)}</td>
                <td class="num font-bold">{t((p) => p.tokensM).toFixed(1)}M</td>
                <td class="num font-bold">{usd(t((p) => p.costUsd))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section class="k-card overflow-hidden">
        <div class="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon name="gitBranch" size={15} class="text-ink" />
          <h2 class="k-heading !text-[14px]">In git</h2>
          <span class="k-mono-tag ml-auto !text-[11px]">ktiro-intents @ {(Number(intent.id) * 2654435761 % 0xfffffff).toString(16).slice(0, 7)}</span>
        </div>
        <ul class="m-0 list-none p-0 font-mono text-[12.5px]">
          {files.map((f) => (
            <li key={f.path} class="flex items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
              <Icon name={f.path.endsWith("/") ? "folder" : "fileText"} size={13} class="flex-none text-muted" />
              <span class="min-w-0 flex-1 truncate">{f.path}</span>
              <span class="hidden font-sans text-[12px] text-faint sm:inline">{f.note}</span>
            </li>
          ))}
        </ul>
        <p class="m-0 border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
          The forge is a data store. Everything above is markdown, written by ktiro, never by a person; this page is a view of it.
        </p>
      </section>
      <section class="k-card k-card--pad">
        <h2 class="k-heading !text-[14px]">Gates</h2>
        <div class="mt-1 divide-y divide-line">
          {intent.gates.map((g) => (
            <GateRow key={g.name} gate={g} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ───────────────────────────── Sidebar ─────────────────────────────

function Sidebar({ intent, all }: { intent: Intent; all: Intent[] }) {
  const blocks = all.filter((x) => x.dependsOn.includes(intent.id));
  const open = blockedBy(all, intent);
  const asks = intent.messages.flatMap((m) => ((m.card?.type === "question" && !m.card.answer) || (m.card?.type === "gate" && !m.card.decision) ? m.card.assigned : []));
  return (
    <aside class="flex min-w-0 flex-col gap-4">
      <div class="k-card k-card--pad">
        <h3 class="k-heading !text-[14px]">People</h3>
        <dl class="k-kv k-kv--stack mt-3">
          <div>
            <dt>Author</dt>
            <dd class="flex items-center gap-2">
              <PersonAvatar id={intent.author} size={20} /> {person(intent.author).name}
            </dd>
          </div>
          {intent.contributors.length ? (
            <div>
              <dt>Contributed</dt>
              <dd class="flex flex-col gap-1.5">
                {intent.contributors.map((c) => (
                  <span key={c} class="flex items-center gap-2">
                    <PersonAvatar id={c} size={20} /> {person(c).name}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
          {asks.length ? (
            <div>
              <dt>Assigned now</dt>
              <dd class="mt-1">
                <Assignees list={asks} />
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
      <div class="k-card k-card--pad">
        <h3 class="k-heading !text-[14px]">Repositories</h3>
        <ul class="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
          {intent.repos.map((r) => {
            const repo = REPOS.find((x) => x.name === r);
            return (
              <li key={r} class="flex items-center gap-2 text-[13px]">
                <Icon name="folder" size={13} class="text-muted" />
                <span class="font-mono">{r}</span>
                {repo?.customerFacing ? <span class="k-pill k-pill--feat ml-auto !py-0 !text-[10.5px]">customer-facing</span> : null}
              </li>
            );
          })}
        </ul>
      </div>
      {intent.dependsOn.length || blocks.length ? (
        <div class="k-card k-card--pad">
          <h3 class="k-heading !text-[14px]">Dependencies</h3>
          {intent.dependsOn.length ? (
            <>
              <div class="mt-2.5 k-label">Depends on</div>
              {intent.dependsOn.map((d) => (
                <DepLink key={d} id={d} all={all} open={open.includes(d)} />
              ))}
            </>
          ) : null}
          {blocks.length ? (
            <>
              <div class="mt-2.5 k-label">Unblocks</div>
              {blocks.map((b) => (
                <DepLink key={b.id} id={b.id} all={all} open={false} />
              ))}
            </>
          ) : null}
        </div>
      ) : null}
      <div class="k-card k-card--pad">
        <h3 class="k-heading !text-[14px]">Definition of done</h3>
        <ul class="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0 text-[13px]">
          {[
            ["Outcome rubric graded", intent.outcome.length > 0 && intent.outcome.every((c) => c.status === "passing")],
            ["Tests in every repository", !!intent.prs?.every((p) => p.tests > 0)],
            ["Benchmarks where performance matters", !!intent.prs?.some((p) => p.benchmark)],
            ["Each repository's docs site updated", !!intent.prs?.every((p) => p.docs)],
            ["Technical review passed, blind", intent.verdicts?.review.verdict === "pass" && intent.verdicts?.security.verdict === "pass"],
            ["Business review evidence for customer-facing changes", !!intent.fastPath || !intent.repos.some((r) => REPOS.find((x) => x.name === r)?.customerFacing) || !!intent.evidence?.length],
            ["Flag at 100% and removed from the code", intent.phase === "done" || intent.canary?.removal?.status === "merged"],
          ].map(([label, ok]) => (
            <li key={label as string} class="flex items-center gap-2">
              <Icon name={ok ? "check" : "circle"} size={13} class={ok ? "text-done" : "text-faint"} strokeWidth={ok ? 2.6 : 1.6} />
              <span class={ok ? "" : "text-muted"}>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function DepLink({ id, all, open }: { id: string; all: Intent[]; open: boolean }) {
  const d = all.find((x) => x.id === id);
  if (!d) return null;
  return (
    <a href={hrefIntent(id)} class="mt-1.5 flex items-center gap-2 text-[13px] text-fg no-underline hover:text-ink">
      <span class="font-mono text-[12px] text-faint">{id}</span>
      <span class="min-w-0 flex-1 truncate">{d.title}</span>
      {open ? <span class="k-pill k-pill--amber !py-0 !text-[10.5px]">open</span> : null}
    </a>
  );
}

function Empty({ icon, text }: { icon: IconName; text: string }) {
  return (
    <div class="k-card flex flex-col items-center gap-2 px-4 py-12 text-center text-muted">
      <Icon name={icon} size={22} />
      {text}
    </div>
  );
}
