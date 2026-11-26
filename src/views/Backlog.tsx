/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// Backlog: everything not yet done, in the order ktiro pulls it. The order is
// computed, never dragged: criticality (set by agents), then value (the
// tenant's one metric), then human importance, with a share of slots kept for
// bugs. Each row says which of those decided its place.

import type { ComponentChildren } from "preact";
import { agent, TENANT } from "../data/org";
import { measuredValue } from "../data/metrics";
import { Icon } from "../components/icons";
import { MiniRail } from "../components/PhaseRail";
import { KindPill, StatusPill } from "../components/Pills";
import { hours, KIND_LABEL, money, PHASE_LABEL, PHASE_SHORT } from "../format";
import { blockedBy, bugReserveStatus, KIND_TIER, nextToPull, rankAll } from "../priority";
import { hrefIntent, navigate } from "../router";
import { now, useStore } from "../store";
import { KINDS, PHASES, type Intent } from "../types";

const IMPORTANCE_LABEL = { high: "High", normal: "Normal", low: "Low" } as const;

/** Which input separated this intent from the one ranked above it. */
function decider(prev: Intent | undefined, i: Intent): "tier" | "value" | "importance" | "age" {
  if (!prev || KIND_TIER[prev.kind] !== KIND_TIER[i.kind]) return "tier";
  if (prev.value.amount !== i.value.amount) return "value";
  if (prev.importance !== i.importance) return "importance";
  return "age";
}

export function BacklogView() {
  const intents = useStore((s) => s.intents);
  const ranked = rankAll(intents);
  const reserveBugs = new Set(
    PHASES.map((ph) => nextToPull(intents, ph))
      .filter((n): n is Intent => !!n && n.kind === "bug")
      .map((n) => n.id),
  );
  const bug = bugReserveStatus(intents);
  const done = intents
    .filter((i) => i.phase === "done")
    .sort((a, b) => (b.phases.at(-1)?.exitedAt ?? 0) - (a.phases.at(-1)?.exitedAt ?? 0));

  return (
    <div>
      <div class="k-eyebrow">Backlog</div>
      <h1 class="mt-1 mb-0 text-[26px] leading-tight font-bold tracking-[-0.01em]">Everything, in pull order</h1>
      <p class="mt-1.5 mb-0 max-w-[70ch] text-[14.5px] text-muted">
        Nobody drags this list. The order is computed from three inputs, and each row shows which one decided its place.
      </p>

      <section class="k-card mt-6 overflow-hidden" aria-labelledby="matrix-heading">
        <div class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <Icon name="columns" size={15} class="text-ink" />
          <h2 id="matrix-heading" class="k-heading !text-[14px]">
            By phase and criticality
          </h2>
          <span class="text-[12.5px] text-muted">Live. Totals show work in flight against each phase's limit; +n marks fast-path flag removals, which ride outside it.</span>
        </div>
        <PhaseKindMatrix intents={intents} />
      </section>

      <div class="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="min-w-0">
          <div class="k-card overflow-x-auto">
            <table class="k-table min-w-[860px]">
              <thead>
                <tr>
                  <th class="w-[1%] text-right">#</th>
                  <th>Intent</th>
                  <th>Criticality</th>
                  <th class="num">Value</th>
                  <th>Importance</th>
                  <th>Phase</th>
                  <th>Why here</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((i, k) => {
                  const d = decider(ranked[k - 1], i);
                  const blocked = blockedBy(intents, i);
                  return (
                    <tr key={i.id} class="is-link" onClick={() => navigate(hrefIntent(i.id))}>
                      <td class="text-right font-mono text-[12px] text-faint">{k + 1}</td>
                      <td class="max-w-[340px]">
                        <a href={hrefIntent(i.id)} class="flex items-center gap-2 text-fg no-underline hover:text-ink" onClick={(e) => e.stopPropagation()}>
                          <span class="font-mono text-[12px] text-faint">{i.id}</span>
                          <span class="truncate font-semibold">{i.title}</span>
                        </a>
                        <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
                          {blocked.length ? (
                            <span class="inline-flex items-center gap-1 text-amber">
                              <Icon name="lock" size={11} /> blocked by {blocked.join(", ")}
                            </span>
                          ) : i.dependsOn.length ? (
                            <span class="inline-flex items-center gap-1">
                              <Icon name="link" size={11} /> after {i.dependsOn.join(", ")}
                            </span>
                          ) : null}
                          {i.fastPath ? (
                            <span class="inline-flex items-center gap-1 text-ink">
                              <Icon name="zap" size={11} /> fast path · completes {i.fastPath.parent}
                            </span>
                          ) : i.origin ? (
                            <span class="inline-flex items-center gap-1">
                              <Icon name="bot" size={11} /> {agent(i.origin).name}
                            </span>
                          ) : null}
                          {i.finding ? (
                            <span class="inline-flex items-center gap-1">
                              <Icon name="shield" size={11} /> finding {i.finding.id}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <KindPill kind={i.kind} />
                      </td>
                      <td class="num">{money(i.value.amount, { sign: true })}</td>
                      <td class="text-muted">{IMPORTANCE_LABEL[i.importance]}</td>
                      <td>
                        <div class="flex items-center gap-2">
                          <MiniRail intent={i} />
                          <StatusPill intent={i} />
                        </div>
                        <div class="mt-1 text-[11.5px] text-muted">{PHASE_LABEL[i.phase]}</div>
                      </td>
                      <td>
                        <Why i={i} decided={d} reserve={reserveBugs.has(i.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <section class="mt-9" aria-labelledby="done-heading">
            <div class="mb-3 flex items-center gap-2">
              <h2 id="done-heading" class="k-heading">
                Done
              </h2>
              <span class="k-count">{done.length}</span>
              <span class="ml-auto text-[12.5px] text-faint">Done means the flag is at 100% and removed from the code · value measured against the control group</span>
            </div>
            <div class="k-card overflow-x-auto">
              <table class="k-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Intent</th>
                    <th>Criticality</th>
                    <th class="num">Estimated</th>
                    <th class="num">Measured</th>
                    <th class="num">Lead time</th>
                  </tr>
                </thead>
                <tbody>
                  {done.map((i) => {
                    const end = i.phases.at(-1)?.exitedAt ?? now();
                    const m = measuredValue(i);
                    return (
                      <tr key={i.id} class="is-link" onClick={() => navigate(hrefIntent(i.id))}>
                        <td>
                          <a href={hrefIntent(i.id)} class="flex items-center gap-2 text-fg no-underline hover:text-ink" onClick={(e) => e.stopPropagation()}>
                            <Icon name="check" size={13} class="flex-none text-done" />
                            <span class="font-mono text-[12px] text-faint">{i.id}</span>
                            <span class="truncate font-semibold">{i.title}</span>
                          </a>
                        </td>
                        <td>
                          <KindPill kind={i.kind} />
                        </td>
                        <td class="num text-muted">{money(i.value.amount, { sign: true })}</td>
                        <td class="num font-semibold">{money(m, { sign: true })}</td>
                        <td class="num">{hours((end - i.createdAt) / 3_600_000)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside class="grid min-w-0 content-start items-start gap-4 md:grid-cols-2 2xl:grid-cols-1">
          <div class="k-card k-card--pad">
            <h2 class="k-heading !text-[14px]">How the order is decided</h2>
            <ol class="m-0 mt-3 flex list-none flex-col gap-3.5 p-0">
              <Rule n={1} title="Criticality" by="set by agents, never people">
                <ol class="m-0 mt-2 grid w-fit list-none grid-cols-[auto_auto] items-center gap-x-3 gap-y-1.5 p-0" aria-label="Criticality, most critical first">
                  {(
                    [
                      ["security", "always first"],
                      ["data-integrity", "ledger correctness"],
                      ["feature", "ranked by value"],
                      ["bug", `${Math.round(TENANT.bugReserve * 100)}% of slots reserved`],
                    ] as const
                  ).map(([kind, note]) => (
                    <li key={kind} class="contents">
                      <KindPill kind={kind} />
                      <span class="text-[11.5px] text-faint">{note}</span>
                    </li>
                  ))}
                </ol>
              </Rule>
              <Rule n={2} title={`Value: ${TENANT.valueMetric.name}`} by={TENANT.valueMetric.unit}>
                <p class="m-0 mt-1 text-[12.5px] leading-relaxed text-muted">
                  Exactly one metric, measurable, never a matter of opinion. Read from <span class="font-mono text-[11.5px]">{TENANT.valueMetric.source}</span>.
                </p>
              </Rule>
              <Rule n={3} title="Importance" by="set by people, weighed last">
                <p class="m-0 mt-1 text-[12.5px] leading-relaxed text-muted">Breaks ties between intents of the same criticality and value.</p>
              </Rule>
            </ol>
            <div class="mt-4 border-t border-line pt-3">
              <div class="flex items-center gap-2 text-[13px] font-semibold">
                <Icon name="bug" size={14} class="text-muted" /> Bug reserve: {Math.round(bug.reserve * 100)}%
              </div>
              <p class="m-0 mt-1 text-[12.5px] leading-relaxed text-muted">
                Bugs hold {bug.bugs} of {bug.total} slots in flight ({Math.round(bug.share * 100)}%). While that's under the reserve, the next free slot goes to the top bug, even ahead of a feature.
              </p>
            </div>
          </div>
          <div class="k-note k-note--accent">
            <Icon name="lightbulb" size={15} class="mt-0.5 flex-none" />
            <span class="text-fg">
              Disagree with a criticality? Say so on the intent. The definer agent re-classifies with your reasoning on record; it can't be overridden by hand.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

const KIND_TONE_VAR: Record<Intent["kind"], string> = {
  security: "var(--k-kind-security)",
  "data-integrity": "var(--k-kind-data)",
  feature: "var(--k-kind-feature)",
  bug: "var(--k-kind-bug)",
};

type MatrixCol = { key: string; label: string; match: (i: Intent) => boolean };

/**
 * Live counts of intents by phase and criticality. Queued intents (waiting for
 * a slot in any phase) get their own column so the phase columns read as work
 * in flight; fast-path flag removals count where they are, alongside the limits.
 */
export function PhaseKindMatrix({ intents, compact }: { intents: Intent[]; compact?: boolean }) {
  const cols: MatrixCol[] = [
    { key: "queued", label: "Queued", match: (i) => i.phase !== "done" && i.status === "queued" },
    ...PHASES.map((ph) => ({
      key: ph,
      label: compact ? PHASE_SHORT[ph] : PHASE_LABEL[ph],
      match: (i: Intent) => i.phase === ph && i.status !== "queued",
    })),
    { key: "done", label: "Done", match: (i) => i.phase === "done" },
  ];
  const cell = (k: Intent["kind"], c: MatrixCol) => intents.filter((i) => i.kind === k && c.match(i));
  const max = Math.max(1, ...KINDS.flatMap((k) => cols.map((c) => cell(k, c).length)));
  return (
    <div class="overflow-x-auto">
      <table class="k-table min-w-[720px] !text-[13px]">
        <thead>
          <tr>
            <th>Criticality</th>
            {cols.map((c) => (
              <th key={c.key} class={`num ${c.key === "done" || c.key === "queued" ? "!text-faint" : ""}`}>
                {c.label}
              </th>
            ))}
            <th class="num">In flight</th>
          </tr>
        </thead>
        <tbody>
          {KINDS.map((k) => {
            const inFlight = intents.filter((i) => i.kind === k && i.phase !== "done" && i.status !== "queued").length;
            return (
              <tr key={k}>
                <td>
                  <KindPill kind={k} />
                </td>
                {cols.map((c) => {
                  const list = cell(k, c);
                  const n = list.length;
                  return (
                    <td
                      key={c.key}
                      class="num"
                      title={n ? `${KIND_LABEL[k]} · ${c.label}: ${list.map((i) => i.id).join(", ")}` : undefined}
                      style={
                        n && c.key !== "done"
                          ? { background: `color-mix(in oklab, ${KIND_TONE_VAR[k]} ${Math.round(6 + (n / max) * 22)}%, var(--k-surface))` }
                          : undefined
                      }
                    >
                      {n ? <span class={c.key === "done" ? "text-muted" : "font-semibold text-fg"}>{n}</span> : <span class="text-faint">·</span>}
                    </td>
                  );
                })}
                <td class="num font-bold">{inFlight}</td>
              </tr>
            );
          })}
          <tr>
            <td class="font-semibold text-muted">All kinds</td>
            {cols.map((c) => {
              const all = intents.filter(c.match);
              const fast = all.filter((i) => i.fastPath).length;
              const lim = TENANT.wip[c.key];
              return (
                <td key={c.key} class="num font-bold" title={fast ? `${fast} fast-path intent${fast === 1 ? "" : "s"} outside the limit` : undefined}>
                  {all.length - fast}
                  {lim ? <span class="font-normal text-faint">/{lim}</span> : null}
                  {fast ? <span class="font-normal text-ink"> +{fast}</span> : null}
                </td>
              );
            })}
            <td class="num font-bold">{intents.filter((i) => i.phase !== "done" && i.status !== "queued").length}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Rule({ n, title, by, children }: { n: number; title: string; by: string; children: ComponentChildren }) {
  return (
    <li class="flex gap-3">
      <span class="grid size-[22px] flex-none place-items-center rounded-full border border-line-2 bg-surface-2 font-mono text-[11px] font-bold">{n}</span>
      <div class="min-w-0 flex-1">
        <div class="text-[13.5px] font-semibold">
          {title} <span class="font-normal text-faint">· {by}</span>
        </div>
        {children}
      </div>
    </li>
  );
}

function Why({ i, decided, reserve }: { i: Intent; decided: "tier" | "value" | "importance" | "age"; reserve: boolean }) {
  const part = (key: typeof decided, text: string) => (
    <span class={decided === key ? "font-semibold text-fg" : "text-faint"}>{text}</span>
  );
  return (
    <div class="text-[12px] whitespace-nowrap">
      {part("tier", KIND_LABEL[i.kind])}
      <span class="text-faint"> › </span>
      {part("value", money(i.value.amount))}
      <span class="text-faint"> › </span>
      {part("importance", i.importance)}
      {decided === "age" ? <span class="text-faint"> › older</span> : null}
      {reserve ? <span class="k-pill k-pill--bug ml-1.5 !py-0 !text-[10.5px]">reserve</span> : null}
    </div>
  );
}
