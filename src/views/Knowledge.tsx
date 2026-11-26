/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// The knowledge base: ktiro-docs, maintained by the knowledge agent, plus the
// decisions every review checks against, the repositories (and whether they
// still operate the same way), and the vocabulary the whole system shares.

import { useState } from "preact/hooks";
import { ADRS, DIGEST, GLOSSARY, type Adr } from "../data/knowledge";
import { FACTORY_REPOS, hoursAgo, REPOS } from "../data/org";
import { AgentAvatar } from "../components/Avatar";
import { Icon, type IconName } from "../components/icons";
import { ago, PHASE_LABEL, pct } from "../format";
import { hrefIntent } from "../router";
import { useStore } from "../store";
import type { AdrProposal, Intent, Repo } from "../types";

/** ADRs proposed by intents in flight, read live from the store. */
function useProposals(): { p: AdrProposal; intent: Intent }[] {
  const intents = useStore((s) => s.intents);
  return intents.flatMap((intent) => (intent.adrProposals ?? []).map((p) => ({ p, intent })));
}

type Section = "overview" | "decisions" | "repositories" | "glossary";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "decisions", label: "Decisions" },
  { id: "repositories", label: "Repositories" },
  { id: "glossary", label: "Glossary" },
];

export function KnowledgeView({ section }: { section?: string }) {
  const current: Section = SECTIONS.some((s) => s.id === section) ? (section as Section) : "overview";
  const open = useProposals().filter((x) => x.p.status === "proposed").length;
  return (
    <div>
      <div class="k-eyebrow">Knowledge</div>
      <h1 class="mt-1 mb-0 text-[26px] leading-tight font-bold tracking-[-0.01em]">What the product knows about itself</h1>
      <p class="mt-1.5 mb-0 max-w-[76ch] text-[14.5px] text-muted">
        <span class="k-mono-tag">ktiro-docs</span> is kept true by the knowledge agent. Every repository's own docs site is kept true by the engineering agent, as part of
        the definition of done.
      </p>
      <nav class="k-tabs mt-6" aria-label="Knowledge sections">
        {SECTIONS.map((s) => (
          <a key={s.id} href={s.id === "overview" ? "#/knowledge" : `#/knowledge/${s.id}`} class={current === s.id ? "is-active" : ""} aria-current={current === s.id ? "page" : undefined}>
            {s.label}
            {s.id === "decisions" ? <span class={`k-count ${open ? "k-count--amber" : ""}`}>{open ? `${open} proposed` : ADRS.length}</span> : null}
            {s.id === "repositories" ? <span class="k-count">{REPOS.length + FACTORY_REPOS.length}</span> : null}
          </a>
        ))}
      </nav>
      <div class="mt-6">
        {current === "overview" ? <Overview /> : null}
        {current === "decisions" ? <Decisions /> : null}
        {current === "repositories" ? <Repositories /> : null}
        {current === "glossary" ? <Glossary /> : null}
      </div>
    </div>
  );
}

// ───────────────────────────── overview ─────────────────────────────

const DIGEST_ICON: Record<(typeof DIGEST)[number]["kind"], IconName> = {
  shipped: "check",
  adr: "book",
  architecture: "layers",
  glossary: "list",
};

function Overview() {
  const product = ADRS.filter((a) => a.scope === "product" && a.status === "accepted").length;
  const local = ADRS.filter((a) => a.scope !== "product").length;
  const fresh = REPOS.filter((r) => r.docsFreshDays <= 3).length;
  return (
    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div class="flex min-w-0 flex-col gap-5">
        <div class="k-card grid grid-cols-2 sm:grid-cols-4">
          <div class="k-stat">
            <strong>{product}</strong>
            <span>product-wide decisions</span>
          </div>
          <div class="k-stat">
            <strong>{local}</strong>
            <span>local decisions in repositories</span>
          </div>
          <div class="k-stat">
            <strong>
              {fresh}/{REPOS.length}
            </strong>
            <span>docs sites updated in 3 days</span>
          </div>
          <div class="k-stat">
            <strong>{FACTORY_REPOS.find((r) => r.name === "ktiro-docs")?.files}</strong>
            <span>pages in ktiro-docs</span>
          </div>
        </div>

        <section class="k-card overflow-hidden">
          <div class="flex items-center gap-2 border-b border-line px-4 py-3">
            <AgentAvatar id="knowledge" size={22} />
            <h2 class="k-heading !text-[14px]">Recent changes</h2>
            <span class="text-[12.5px] text-muted">Written by knowledge-agent, never by hand</span>
          </div>
          <ul class="m-0 list-none p-0">
            {DIGEST.map((d) => (
              <li key={d.text} class="flex items-start gap-3 border-t border-line px-4 py-3 first:border-t-0">
                <span class={`mt-px grid size-[22px] flex-none place-items-center rounded-full border border-line bg-surface ${d.kind === "shipped" ? "text-done" : "text-ink"}`}>
                  <Icon name={DIGEST_ICON[d.kind]} size={12} strokeWidth={2.2} />
                </span>
                <div class="min-w-0 flex-1 text-[13.5px]">{d.text}</div>
                {d.intent ? (
                  <a href={hrefIntent(d.intent)} class="k-mono-tag !text-[11px]">
                    {d.intent}
                  </a>
                ) : null}
                <span class="w-14 flex-none text-right font-mono text-[11.5px] text-faint">{ago(hoursAgo(d.at))}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside class="flex min-w-0 flex-col gap-4">
        <div class="k-card k-card--pad">
          <h3 class="k-heading !text-[14px]">How it stays true</h3>
          <ul class="m-0 mt-3 flex list-none flex-col gap-3 p-0 text-[13px] leading-relaxed">
            {[
              ["check", "After every intent ships, the knowledge agent writes a digest and updates the architecture map."],
              ["book", "Decisions are ADRs: product-wide in ktiro-docs, local in the repository they govern."],
              ["eye", "Technical review checks every merge set against both. A change that sets a new rule proposes a net-new ADR there, and a person always agrees it."],
              ["layers", "Changing an existing ADR is only recommended in planning, against a high burden of proof."],
              ["fileText", "Each repository's docs site is part of its definition of done: no docs, no merge."],
            ].map(([icon, text]) => (
              <li key={text} class="flex gap-2.5">
                <Icon name={icon as IconName} size={14} class="mt-0.5 flex-none text-ink" />
                <span class="text-muted">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <a href="#/knowledge/decisions" class="k-card k-card--pad k-card--hover block text-fg no-underline">
          <div class="flex items-center justify-between">
            <h3 class="k-heading !text-[14px]">Most-checked decisions</h3>
            <Icon name="arrowRight" size={14} class="text-muted" />
          </div>
          <ul class="m-0 mt-2.5 list-none p-0">
            {[...ADRS]
              .filter((a) => a.status === "accepted")
              .sort((a, b) => b.checks - a.checks)
              .slice(0, 4)
              .map((a) => (
                <li key={a.scope + a.id} class="flex items-center gap-2 py-1.5 text-[13px]">
                  <span class="k-mono-tag !text-[11px]">{a.id}</span>
                  <span class="min-w-0 flex-1 truncate">{a.title}</span>
                  <span class="font-mono text-[11.5px] text-faint">{a.checks}</span>
                </li>
              ))}
          </ul>
        </a>
      </aside>
    </div>
  );
}

// ───────────────────────────── decisions ─────────────────────────────

type Scope = "all" | "product" | "local";

const STATUS_TONE: Record<Adr["status"], string> = {
  accepted: "k-pill--done",
  proposed: "k-pill--accent",
  superseded: "k-pill--stone",
};

const LIFECYCLE: { icon: IconName; title: string; where: string; text: string }[] = [
  {
    icon: "shieldCheck",
    title: "New decisions",
    where: "Technical review",
    text: "When a change sets a rule others must follow, the review agent drafts a net-new ADR. It is never recorded until a person agrees, however confident the agents are.",
  },
  {
    icon: "layers",
    title: "Changing a decision",
    where: "Planning",
    text: "The only place an existing ADR may be recommended for change, against a deliberately high bar: alternatives weighed, every consumer found, an impact report, a migration path, and the owner's agreement.",
  },
  {
    icon: "book",
    title: "Recording",
    where: "Knowledge agent",
    text: "Once agreed, the knowledge agent writes it to ktiro-docs (product-wide) or the repository's own ADRs (local), and technical review checks every later change against it.",
  },
];

function Proposed() {
  const rows = useProposals();
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="proposed-adrs">
      <div class="mb-2.5 flex flex-wrap items-center gap-2">
        <h2 id="proposed-adrs" class="k-heading">
          Proposed by intents in flight
        </h2>
        <span class="text-[12.5px] text-muted">Read live from ktiro-intents; nothing here is recorded until a person agrees</span>
      </div>
      <div class="grid gap-3 lg:grid-cols-2">
        {rows.map(({ p, intent }) => {
          const tab = p.kind === "new" ? "technical" : "plan";
          const met = p.burden?.filter((b) => b.met).length ?? 0;
          return (
            <article key={intent.id + p.id} class={`k-card k-card--pad ${p.status === "proposed" ? "border-amber" : ""}`}>
              <div class="flex flex-wrap items-center gap-2">
                <span class="k-mono-tag !text-[11px]">{p.id}</span>
                <span class={`k-pill ${p.kind === "new" ? "k-pill--accent" : "k-pill--amber"}`}>{p.kind === "new" ? "net-new" : "change to existing"}</span>
                <span class={`k-pill ${p.status === "agreed" ? "k-pill--done" : p.status === "rejected" ? "k-pill--stone" : "k-pill--neutral"}`}>{p.status}</span>
                <span class="ml-auto inline-flex items-center gap-1.5 text-[12px] text-muted">
                  {p.scope === "product" ? <Icon name="book" size={12} class="text-ink" /> : <Icon name="folder" size={12} />}
                  {p.scope === "product" ? "ktiro-docs" : p.scope}
                </span>
              </div>
              <h3 class="mt-2 mb-0 text-[14.5px] leading-snug font-bold">{p.title}</h3>
              <dl class="k-kv k-kv--stack mt-2.5">
                <div>
                  <dt>Context</dt>
                  <dd class="!text-[13px] leading-relaxed">{p.context}</dd>
                </div>
                <div>
                  <dt>{p.kind === "new" ? "Decision" : "Proposed change"}</dt>
                  <dd class="!text-[13px] leading-relaxed">{p.decision}</dd>
                </div>
              </dl>
              {p.burden ? (
                <div class="mt-3 rounded-lg border border-line bg-surface-2 p-3">
                  <div class="flex items-center justify-between text-[12.5px]">
                    <span class="font-semibold">Burden of proof</span>
                    <span class={`font-mono ${met === p.burden.length ? "text-done" : "text-amber"}`}>
                      {met}/{p.burden.length} met
                    </span>
                  </div>
                  <ul class="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[12.5px]">
                    {p.burden.map((b) => (
                      <li key={b.item} class="flex items-start gap-2">
                        <Icon name={b.met ? "check" : "circle"} size={13} strokeWidth={b.met ? 2.6 : 1.6} class={`mt-0.5 flex-none ${b.met ? "text-done" : "text-faint"}`} />
                        <span class={b.met ? "" : "text-muted"}>{b.item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <a href={hrefIntent(intent.id, tab)} class="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[12.5px] text-fg no-underline hover:text-ink">
                <span class="font-mono text-faint">{intent.id}</span>
                <span class="min-w-0 flex-1 truncate">{intent.title}</span>
                <span class="text-muted">{PHASE_LABEL[intent.phase]}</span>
                <Icon name="arrowRight" size={13} class="text-muted" />
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Decisions() {
  const [scope, setScope] = useState<Scope>("all");
  const rows = ADRS.filter((a) => scope === "all" || (scope === "product" ? a.scope === "product" : a.scope !== "product"));
  return (
    <div class="flex flex-col gap-5">
      <ol class="m-0 grid list-none gap-px overflow-hidden rounded-[10px] border border-line bg-line p-0 md:grid-cols-3">
        {LIFECYCLE.map((l) => (
          <li key={l.title} class="bg-surface p-4">
            <div class="flex items-center gap-2">
              <span class="grid size-7 place-items-center rounded-full bg-surface-2 text-ink">
                <Icon name={l.icon} size={14} />
              </span>
              <span class="text-[13.5px] font-semibold">{l.title}</span>
              <span class="k-pill k-pill--neutral ml-auto !text-[11px]">{l.where}</span>
            </div>
            <p class="mt-2 mb-0 text-[12.5px] leading-relaxed text-muted">{l.text}</p>
          </li>
        ))}
      </ol>
      <Proposed />
      <h2 class="k-heading">Recorded decisions</h2>
      <div class="flex flex-wrap items-center gap-3">
        <p class="m-0 max-w-[70ch] text-[13.5px] text-muted">
          Product-wide decisions govern every repository; local ones govern the repository that holds them. A change that breaks either is a review concern, whoever wrote it.
        </p>
        <div class="k-seg ml-auto" role="tablist" aria-label="Scope">
          {(["all", "product", "local"] as Scope[]).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={scope === s} class={scope === s ? "is-active" : ""} onClick={() => setScope(s)}>
              {s === "all" ? "All" : s === "product" ? "Product-wide" : "Local"}
            </button>
          ))}
        </div>
      </div>
      <div class="k-card overflow-x-auto">
        <table class="k-table">
          <thead>
            <tr>
              <th>Decision</th>
              <th>Scope</th>
              <th>Status</th>
              <th>Date</th>
              <th class="num">Checked by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.scope + a.id} class={a.status === "superseded" ? "opacity-70" : ""}>
                <td class="!py-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="k-mono-tag !text-[11px]">{a.id}</span>
                    <strong class="text-[13.5px]">{a.title}</strong>
                  </div>
                  <div class="mt-1 max-w-[70ch] text-[12.5px] leading-relaxed text-muted">{a.summary}</div>
                  {a.supersededBy ? <div class="mt-0.5 text-[12px] text-faint">superseded by {a.supersededBy}</div> : null}
                </td>
                <td class="whitespace-nowrap">
                  {a.scope === "product" ? (
                    <span class="inline-flex items-center gap-1.5 text-[12.5px]">
                      <Icon name="book" size={13} class="text-ink" /> ktiro-docs
                    </span>
                  ) : (
                    <span class="inline-flex items-center gap-1.5 font-mono text-[12px]">
                      <Icon name="folder" size={13} class="text-muted" /> {a.scope}
                    </span>
                  )}
                </td>
                <td>
                  <span class={`k-pill ${STATUS_TONE[a.status]}`}>{a.status}</span>
                </td>
                <td class="font-mono text-[12px] whitespace-nowrap text-muted">{a.date}</td>
                <td class="num">{a.checks} intents</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────────────────────────── repositories ─────────────────────────────

/** The version most repositories are on is the baseline; anything else is drift. */
function baseline(key: "toolchain" | "workflows") {
  const counts = new Map<string, number>();
  REPOS.forEach((r) => counts.set(r[key], (counts.get(r[key]) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

const STALE_DAYS = 5;
const needsBenchmarks = (r: Repo) => (r.archetype === "go" || r.archetype === "node") && !r.benchmarks;

function Repositories() {
  const tc = baseline("toolchain");
  const wf = baseline("workflows");
  const drift: { repo: string; text: string; by: "process" | "knowledge" }[] = [];
  for (const r of REPOS) {
    if (r.toolchain !== tc) drift.push({ repo: r.name, text: `toolchain ${r.toolchain}, baseline is ${tc}`, by: "process" });
    if (r.workflows !== wf) drift.push({ repo: r.name, text: `workflows ${r.workflows}, baseline is ${wf}`, by: "process" });
    if (r.docsFreshDays > STALE_DAYS) drift.push({ repo: r.name, text: `docs site last updated ${r.docsFreshDays} days ago`, by: "knowledge" });
    if (needsBenchmarks(r)) drift.push({ repo: r.name, text: "no benchmarks", by: "process" });
  }
  return (
    <div class="flex flex-col gap-5">
      <div class="k-card grid grid-cols-2 sm:grid-cols-4">
        <div class="k-stat">
          <strong class="!text-[18px]">{tc}</strong>
          <span>toolchain baseline</span>
        </div>
        <div class="k-stat">
          <strong class="!text-[18px]">{wf}</strong>
          <span>reusable workflows</span>
        </div>
        <div class="k-stat">
          <strong>
            {REPOS.length - new Set(drift.map((d) => d.repo)).size}/{REPOS.length}
          </strong>
          <span>repositories with no drift</span>
        </div>
        <div class="k-stat">
          <strong>1</strong>
          <span>way to lint, build, test and ship</span>
        </div>
      </div>

      {drift.length ? (
        <div class="k-note">
          <Icon name="alertTriangle" size={16} class="mt-0.5 flex-none" />
          <div class="min-w-0 flex-1 text-fg">
            <strong class="text-amber">
              {drift.length} drift {drift.length === 1 ? "finding" : "findings"}.
            </strong>{" "}
            Every repository should operate the same way. Each finding is raised as an intent by the agent that owns it.
            <ul class="mt-2 mb-0 flex list-none flex-col gap-1.5 p-0">
              {drift.map((d) => (
                <li key={d.repo + d.text} class="flex flex-wrap items-center gap-2 text-[13px]">
                  <span class="font-mono">{d.repo}</span>
                  <span class="text-muted">{d.text}</span>
                  <span class="ml-auto inline-flex items-center gap-1.5 text-[12px] text-muted">
                    <AgentAvatar id={d.by} size={16} /> {d.by}-agent will raise an intent
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <section class="k-card overflow-hidden">
        <div class="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon name="box" size={15} class="text-ink" />
          <h2 class="k-heading !text-[14px]">Product repositories</h2>
          <span class="text-[12.5px] text-muted">Same toolchain, same workflows, own docs site</span>
        </div>
        <div class="overflow-x-auto">
          <table class="k-table">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Archetype</th>
                <th>Toolchain</th>
                <th>Workflows</th>
                <th>Docs site</th>
                <th class="num">Coverage</th>
                <th>Benchmarks</th>
              </tr>
            </thead>
            <tbody>
              {REPOS.map((r) => (
                <tr key={r.name}>
                  <td class="!py-2.5">
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-[13px] font-semibold">{r.name}</span>
                      {r.customerFacing ? <span class="k-pill k-pill--feat !py-0 !text-[10.5px]">customer-facing</span> : null}
                    </div>
                    <div class="mt-0.5 text-[12px] text-muted">{r.purpose}</div>
                  </td>
                  <td>
                    <span class="k-chip !py-0.5 !text-[11.5px]">{r.archetype}</span>
                  </td>
                  <td>
                    <span class={`k-pill ${r.toolchain === tc ? "k-pill--neutral" : "k-pill--amber"}`}>{r.toolchain}</span>
                  </td>
                  <td>
                    <span class={`k-pill ${r.workflows === wf ? "k-pill--neutral" : "k-pill--amber"}`}>{r.workflows}</span>
                  </td>
                  <td>
                    <div class="font-mono text-[12px]">{r.docsSite.replace("docs.ledgerline.dev", "docs…")}</div>
                    <div class={`text-[11.5px] ${r.docsFreshDays > STALE_DAYS ? "text-amber" : "text-muted"}`}>
                      {r.docsFreshDays === 0 ? "updated today" : `updated ${r.docsFreshDays}d ago`}
                    </div>
                  </td>
                  <td class="num">{r.coverage ? pct(r.coverage) : "—"}</td>
                  <td>
                    {r.benchmarks ? (
                      <Icon name="check" size={14} class="text-done" strokeWidth={2.4} />
                    ) : needsBenchmarks(r) ? (
                      <span class="k-pill k-pill--amber">missing</span>
                    ) : (
                      <span class="text-[12px] text-faint">n/a</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section class="k-card overflow-hidden">
        <div class="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon name="settings" size={15} class="text-ink" />
          <h2 class="k-heading !text-[14px]">Factory repositories</h2>
          <span class="text-[12.5px] text-muted">ktiro is the only writer; people work through this interface</span>
        </div>
        <ul class="m-0 list-none p-0">
          {FACTORY_REPOS.map((r) => (
            <li key={r.name} class="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
              <Icon name="lock" size={13} class="flex-none text-muted" />
              <span class="w-[150px] flex-none font-mono text-[13px] font-semibold">{r.name}</span>
              <span class="min-w-0 flex-1 text-[13px] text-muted">{r.purpose}</span>
              <span class="hidden font-mono text-[11.5px] text-faint sm:inline">{r.files} files</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ───────────────────────────── glossary ─────────────────────────────

function Glossary() {
  return (
    <dl class="m-0 grid gap-3 md:grid-cols-2">
      {GLOSSARY.map((g) => (
        <div key={g.term} class="k-card k-card--pad">
          <dt class="text-[14px] font-bold">{g.term}</dt>
          <dd class="mx-0 mt-1 mb-0 text-[13.5px] leading-relaxed text-muted">{g.definition}</dd>
        </div>
      ))}
    </dl>
  );
}
