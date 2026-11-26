/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// Flow: the phase board. Each phase holds at most its WIP limit; anything
// beyond waits in that phase's queue, pulled by priority when a slot frees.
// Gates sit between the columns. Above the board: the merge lane (one intent
// merges at a time, across every repository it touches, as it leaves technical
// review and deploys dark into business review), the bug reserve, and the gate
// policy. Fast-path intents (flag removals) ride in a fast lane beside the
// limits rather than taking a slot.

import { TENANT, person } from "../data/org";
import { PersonAvatar } from "../components/Avatar";
import { Icon } from "../components/icons";
import { KindPill } from "../components/Pills";
import { money, PHASE_LABEL } from "../format";
import { activeIn, blockedBy, bugReserveStatus, compareIntents, fastPathIn, hasSlot, nextToPull, queuedFor, wipLimit } from "../priority";
import { hrefIntent } from "../router";
import { useStore } from "../store";
import { PHASES, type Card, type Intent, type Phase } from "../types";

function openAsks(i: Intent) {
  return i.messages
    .map((m) => m.card)
    .filter((c): c is Extract<Card, { type: "question" | "gate" }> => (c?.type === "question" && !c.answer) || (c?.type === "gate" && !c.decision));
}
function openAssignees(i: Intent): string[] {
  const ids = new Set<string>();
  openAsks(i).forEach((c) => c.assigned.forEach((a) => ids.add(a.person)));
  return [...ids];
}

/** Accepted in business review, holding its slot until operate has room to start the rollout. */
const acceptedWaiting = (i: Intent) => i.phase === "business" && i.gates.find((g) => g.to === "operate")?.state === "approved";
/** Technically sound, holding in technical review until business review has a slot to deploy into. */
const soundWaiting = (i: Intent) => i.phase === "technical" && i.status === "merging" && !i.prs?.some((p) => p.state === "merging" || p.state === "merged");

export function FlowView() {
  const intents = useStore((s) => s.intents);
  const holder = intents.find((i) => i.prs?.some((p) => p.state === "merging"));
  const lineUp = intents.filter(soundWaiting);
  const bug = bugReserveStatus(intents);
  const done = intents.filter((i) => i.phase === "done");

  return (
    <div>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="k-eyebrow">Flow</div>
          <h1 class="mt-1 mb-0 text-[26px] leading-tight font-bold tracking-[-0.01em]">Intents moving through the factory</h1>
          <p class="mt-1.5 mb-0 max-w-[72ch] text-[14.5px] text-muted">
            Every phase has a hard limit on work in flight. Anything past it waits in the phase's queue and is pulled by priority when a slot frees. Done means the flag is at 100% and removed from the code.
          </p>
        </div>
      </div>

      {/* ── Lane, reserve, policy ── */}
      <div class="mt-6 grid gap-3 lg:grid-cols-3">
        <div class="k-card k-card--pad">
          <div class="flex items-center gap-2">
            <Icon name="gitMerge" size={16} class="text-ink" />
            <h2 class="k-heading !text-[14px]">Merge lane</h2>
            <span class={`k-pill ml-auto ${holder ? "k-pill--accent" : "k-pill--neutral"}`}>
              {holder ? <span class="k-live-dot" /> : null}
              {holder ? "held" : "free"}
            </span>
          </div>
          <p class="mt-1.5 mb-3 text-[12.5px] text-muted">
            When technical review passes, ktiro merges the whole set together, one intent at a time across every repository, and deploys it dark into business review.
          </p>
          {holder ? (
            <a href={hrefIntent(holder.id, "changes")} class="flex items-center gap-2 text-[13px] text-fg no-underline hover:text-ink">
              <span class="font-mono text-[12px] text-faint">{holder.id}</span>
              <span class="min-w-0 flex-1 truncate font-semibold">{holder.title}</span>
              <span class="font-mono text-[11.5px] text-muted">
                {holder.prs?.filter((p) => p.state === "merged").length}/{holder.prs?.length} merged
              </span>
            </a>
          ) : (
            <div class="text-[13px] text-muted">Nothing merging right now.</div>
          )}
          {lineUp.length ? (
            <ul class="m-0 mt-2.5 list-none border-t border-line p-0 pt-2">
              {lineUp.map((i) => (
                <LaneRow key={i.id} i={i} note="sound · waiting for a business review slot" />
              ))}
            </ul>
          ) : null}
        </div>

        <div class="k-card k-card--pad">
          <div class="flex items-center gap-2">
            <Icon name="bug" size={16} class="text-ink" />
            <h2 class="k-heading !text-[14px]">Bug reserve</h2>
            <span class={`k-pill ml-auto ${bug.share >= bug.reserve ? "k-pill--done" : "k-pill--amber"}`}>
              {bug.share >= bug.reserve ? "met" : "under"}
            </span>
          </div>
          <p class="mt-1.5 mb-3 text-[12.5px] text-muted">
            {Math.round(bug.reserve * 100)}% of work in flight is kept for bugs, so features never starve them. Under the reserve, the next free slot goes to the top bug.
          </p>
          <div class="flex items-center gap-3">
            <div class="relative h-2 flex-1 rounded-full bg-line">
              <span class="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.min(100, bug.share * 100)}%` }} />
              <span class="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-fg" style={{ left: `${bug.reserve * 100}%` }} title={`Reserve: ${Math.round(bug.reserve * 100)}%`} />
            </div>
            <span class="font-mono text-[12.5px]">
              {bug.bugs}/{bug.total}
            </span>
          </div>
          <div class="mt-1.5 text-[12px] text-faint">
            {Math.round(bug.share * 100)}% bugs in flight · reserve marker at {Math.round(bug.reserve * 100)}%
          </div>
        </div>

        <div class="k-card k-card--pad">
          <div class="flex items-center gap-2">
            <Icon name="skip" size={16} class="text-ink" />
            <h2 class="k-heading !text-[14px]">Gate policy</h2>
            <a href="#/setup" class="ml-auto text-[12.5px] font-semibold text-ink no-underline hover:underline">
              Edit
            </a>
          </div>
          <p class="mt-1.5 mb-2.5 text-[12.5px] text-muted">
            Agents skip the person when p(success) ≥ {TENANT.autoSkip.minPSuccess.toFixed(2)} and impact is {TENANT.autoSkip.maxImpact} or less, except:
          </p>
          <ul class="m-0 flex list-none flex-col gap-1.5 p-0 text-[12.5px]">
            <li class="flex items-start gap-2">
              <Icon name="eye" size={13} class="mt-0.5 flex-none text-ink" />
              <span>
                <strong class="font-semibold">Technical review</strong> <span class="text-muted">is agents only; a person only at a wall or to agree a net-new ADR</span>
              </span>
            </li>
            <li class="flex items-start gap-2">
              <Icon name="hand" size={13} class="mt-0.5 flex-none text-amber" />
              <span>
                <strong class="font-semibold">Business review</strong> <span class="text-muted">is always a person for functional changes; skipped for no-op fast paths</span>
              </span>
            </li>
            <li class="flex items-start gap-2">
              <Icon name="flag" size={13} class="mt-0.5 flex-none text-done" />
              <span>
                <strong class="font-semibold">Done</strong> <span class="text-muted">when the flag is at 100% and removed from the code</span>
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* ── Board ── */}
      <div class="mt-6 -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        <div class="flex min-w-[1160px] items-stretch">
          {PHASES.map((ph, k) => (
            <div key={ph} class="contents">
              <Column phase={ph} intents={intents} done={ph === "operate" ? done : undefined} />
              {k < PHASES.length - 1 ? <GateGap intents={intents} index={k} /> : null}
            </div>
          ))}
        </div>
      </div>

      {/* ── Legend ── */}
      <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
        <span class="flex items-center gap-1.5">
          <span class="k-swatch bg-accent" /> agents working
        </span>
        <span class="flex items-center gap-1.5">
          <span class="k-swatch bg-amber" /> waiting on a person
        </span>
        <span class="flex items-center gap-1.5">
          <span class="k-swatch bg-line" /> free slot
        </span>
        <span class="flex items-center gap-1.5">
          <Icon name="zap" size={12} class="text-ink" /> fast lane, outside the limit
        </span>
        <span class="flex items-center gap-1.5">
          <GateGlyph waiting={false} small /> gate between phases
        </span>
        <span class="flex items-center gap-1.5">
          <GateGlyph waiting small /> people deciding at that gate
        </span>
        <span>Cards are in pull order: criticality, then value, then importance.</span>
      </div>
    </div>
  );
}

function LaneRow({ i, note }: { i: Intent; note: string }) {
  return (
    <li class="py-1">
      <a href={hrefIntent(i.id)} class="flex items-center gap-2 text-[12.5px] text-fg no-underline hover:text-ink">
        <span class="font-mono text-[11.5px] text-faint">{i.id}</span>
        <span class="min-w-0 flex-1 truncate">{i.title}</span>
        <span class="whitespace-nowrap text-[11.5px] text-muted">{note}</span>
      </a>
    </li>
  );
}

const COLUMN_NOTE: Partial<Record<Phase, string>> = {
  technical: "Agents only, blind",
  business: "Live behind the flag",
  operate: "Least to most deployed, then done",
};

/** How far an operate card's flag has rolled out: least deployed first. */
function deployed(i: Intent): number {
  const e = i.canary?.exposure;
  return e && e.step >= 0 ? e.steps[e.step] + e.elapsedH / (e.burnInH * 100) : 0;
}

function Column({ phase, intents, done }: { phase: Phase; intents: Intent[]; done?: Intent[] }) {
  const active = activeIn(intents, phase).sort(phase === "operate" ? (a, b) => deployed(a) - deployed(b) : compareIntents);
  const fast = fastPathIn(intents, phase);
  const queued = queuedFor(intents, phase);
  const limit = wipLimit(phase);
  const waiting = active.filter((i) => i.status === "waiting-human").length;
  const next = nextToPull(intents, phase);
  const slot = hasSlot(intents, phase);
  return (
    <section class="flex min-w-[178px] flex-1 basis-0 flex-col" aria-label={PHASE_LABEL[phase]}>
      <header class="mb-2.5">
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="k-heading truncate !text-[13.5px]">{PHASE_LABEL[phase]}</h2>
          <span class={`font-mono text-[12.5px] ${active.length >= limit ? "font-bold text-fg" : "text-muted"}`}>
            {active.length}/{limit}
          </span>
        </div>
        <div class="mt-0.5 h-4 text-[11.5px] text-faint">{COLUMN_NOTE[phase] ?? ""}</div>
        <div class="mt-1 flex gap-[3px]" role="img" aria-label={`${active.length} of ${limit} slots in use, ${waiting} waiting on a person`}>
          {Array.from({ length: limit }, (_, k) => (
            <span
              key={k}
              class="h-[6px] flex-1 rounded-full transition-colors duration-500"
              style={{ background: k < waiting ? "var(--k-amber)" : k < active.length ? "var(--k-accent)" : "var(--k-line)" }}
            />
          ))}
        </div>
      </header>

      <div class="flex flex-1 flex-col gap-2 rounded-[10px] bg-[color-mix(in_oklab,var(--k-surface-2)_55%,transparent)] p-2">
        {active.map((i) => (
          <FlowCard key={i.id} i={i} />
        ))}
        {Array.from({ length: Math.max(0, limit - active.length) }, (_, k) => (
          <div key={`free-${k}`} class="grid h-[58px] place-items-center rounded-lg border border-dashed border-line-2 text-[12px] text-faint">
            free slot
          </div>
        ))}

        {fast.length ? (
          <div class="mt-1 rounded-lg border border-[color-mix(in_oklab,var(--k-accent)_35%,var(--k-line))] bg-[color-mix(in_oklab,var(--k-accent)_6%,var(--k-surface))] p-1.5">
            <div class="mb-1 flex items-center gap-1.5 px-1 text-[11.5px] font-semibold text-ink">
              <Icon name="zap" size={12} /> Fast lane · outside the limit
            </div>
            {fast.map((i) => (
              <a key={i.id} href={hrefIntent(i.id)} class="flex flex-col gap-0.5 rounded-md px-1.5 py-1 text-fg no-underline hover:bg-surface" title={i.title}>
                <span class="flex items-center gap-1.5 text-[12px]">
                  <span class="font-mono text-[11px] text-faint">{i.id}</span>
                  <span class="min-w-0 flex-1 truncate">{i.title}</span>
                </span>
                <span class="text-[11px] text-muted">flag removal for {i.fastPath!.parent} · skips business review</span>
              </a>
            ))}
          </div>
        ) : null}

        {queued.length ? (
          <div class="mt-1.5 border-t border-line pt-2">
            <div class="mb-1 flex items-center gap-1.5 px-1 text-[12px] font-semibold text-muted">
              <Icon name="clock" size={12} /> Queued · {queued.length}
            </div>
            <ul class="m-0 flex list-none flex-col p-0">
              {queued.map((i) => {
                const blocked = blockedBy(intents, i);
                const reason = blocked.length ? `blocked by ${blocked.join(", ")}` : !slot ? "WIP full" : "pulling";
                const isNext = next?.id === i.id;
                return (
                  <li key={i.id}>
                    <a href={hrefIntent(i.id)} class="flex flex-col gap-0.5 rounded-md px-1.5 py-1.5 text-fg no-underline hover:bg-surface">
                      <span class="flex items-center gap-1.5 text-[12.5px]">
                        <KindPill kind={i.kind} compact />
                        <span class="font-mono text-[11px] text-faint">{i.id}</span>
                        <span class="min-w-0 flex-1 truncate">{i.title}</span>
                      </span>
                      <span class="flex items-center gap-1.5 pl-0.5 text-[11.5px]">
                        <span class={blocked.length ? "text-amber" : "text-faint"}>{reason}</span>
                        {isNext && !blocked.length ? <span class="k-pill k-pill--accent !py-0 !text-[10.5px]">next</span> : null}
                        {isNext && i.kind === "bug" && queued[0]?.id !== i.id ? (
                          <span class="k-pill k-pill--bug !py-0 !text-[10.5px]">reserve</span>
                        ) : null}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {done ? <DoneSection done={done} intents={intents} /> : null}
      </div>
    </section>
  );
}

/** One line on what is happening, in the terms of the phase it's in. */
function cardLine(i: Intent): { text: string; tone: "amber" | "live" | "muted" | "done" } {
  const asks = openAsks(i);
  const e = i.canary?.exposure;
  if (i.phase === "technical") {
    if (i.status === "waiting-human") {
      const adr = asks.some((c) => c.type === "question" && c.question.trigger === "new-adr");
      return { text: adr ? "Net-new ADR needs agreement" : "Agent hit a wall", tone: "amber" };
    }
    if (soundWaiting(i)) return { text: "Sound · waiting to merge", tone: "muted" };
  }
  if (i.phase === "business" && e) {
    if (acceptedWaiting(i)) return { text: "Accepted · waiting for operate", tone: "muted" };
    if (i.status === "waiting-human") return { text: "Live behind flag · reviewers only", tone: "amber" };
    if (i.canary?.deploy.status === "progressing") return { text: "Deploying dark", tone: "live" };
  }
  if (i.phase === "operate" && e) {
    if (i.canary?.removal && i.canary.removal.status !== "merged") return { text: `Flag at 100% · ${i.canary.removal.intent} removing it`, tone: "done" };
    if (e.step >= 0) return { text: `Flag at ${e.steps[e.step]}% · ${e.elapsedH}/${e.burnInH}h burn-in`, tone: "live" };
  }
  if (i.status === "waiting-human") return { text: i.statusText, tone: "amber" };
  if (i.status === "working" || i.status === "merging" || i.status === "canary") return { text: i.statusText, tone: "live" };
  return { text: i.statusText, tone: "muted" };
}

function FlowCard({ i }: { i: Intent }) {
  const line = cardLine(i);
  const waiting = line.tone === "amber";
  const who = waiting ? openAssignees(i) : [];
  const e = i.canary?.exposure;
  return (
    <a
      href={hrefIntent(i.id)}
      class={`k-card k-card--hover relative block animate-rise overflow-hidden p-3 text-fg no-underline ${waiting ? "border-[color-mix(in_oklab,var(--k-amber)_45%,var(--k-line))]" : ""}`}
    >
      {waiting ? <span class="absolute inset-y-0 left-0 w-[3px] bg-amber" /> : null}
      <div class="flex items-center gap-1.5">
        <KindPill kind={i.kind} compact />
        <span class="font-mono text-[11.5px] text-faint">{i.id}</span>
        <span class="ml-auto font-mono text-[11.5px] text-muted">{money(i.value.amount, { sign: true })}</span>
      </div>
      <div class="mt-1.5 line-clamp-2 text-[13px] leading-snug font-semibold">{i.title}</div>
      {i.phase === "operate" && e && e.step >= 0 ? (
        <div class="mt-2 flex items-center gap-2" title={`${e.flag}: ${e.steps[e.step]}% of accounts`}>
          <Icon name="flag" size={11} class="flex-none text-muted" />
          <span class="k-track flex-1">
            <span style={{ width: `${e.steps[e.step]}%`, background: e.steps[e.step] === 100 ? "var(--k-done)" : undefined }} />
          </span>
          <span class="font-mono text-[11px] text-muted">{e.steps[e.step]}%</span>
        </div>
      ) : null}
      <div class="mt-2 flex items-start gap-1.5 text-[11.5px] leading-snug">
        {line.tone === "amber" ? (
          <Icon name="hand" size={12} class="mt-px flex-none text-amber" />
        ) : line.tone === "live" ? (
          <span class="k-live-dot mt-[5px] !size-[6px]" />
        ) : line.tone === "done" ? (
          <Icon name="zap" size={12} class="flex-none text-ink" />
        ) : (
          <Icon name="clock" size={12} class="flex-none text-faint" />
        )}
        <span class={`min-w-0 flex-1 line-clamp-2 ${line.tone === "amber" ? "text-amber" : "text-muted"}`} title={line.text}>
          {line.text}
        </span>
        {who.length ? (
          <span class="flex -space-x-1" title={who.map((p) => person(p).name).join(", ")}>
            {who.slice(0, 3).map((p) => (
              <span key={p} class="rounded-full ring-2 ring-surface">
                <PersonAvatar id={p} size={16} />
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </a>
  );
}

function GateGlyph({ waiting, small }: { waiting: boolean; small?: boolean }) {
  const size = small ? 10 : 16;
  return (
    <span
      class={`inline-block flex-none rotate-45 rounded-[3px] border ${waiting ? "border-amber bg-[color-mix(in_oklab,var(--k-amber)_18%,var(--k-surface))]" : "border-line-3 bg-surface"}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
    />
  );
}

function GateGap({ intents, index }: { intents: Intent[]; index: number }) {
  const from = PHASES[index];
  const waiting = intents.filter((i) => i.phase === from && i.gates[index]?.state === "waiting").length;
  const name = intents[0]?.gates[index]?.name ?? "";
  return (
    <div class="relative flex w-7 flex-none flex-col items-center pt-[74px]" title={`${name}${waiting ? `: ${waiting} waiting on a person` : ""}`}>
      <span class="absolute top-[80px] bottom-6 w-px bg-line" />
      <span class="relative z-[1] flex flex-col items-center gap-1.5 bg-page py-1">
        <GateGlyph waiting={waiting > 0} />
        <span class={`font-mono text-[11px] ${waiting ? "font-bold text-amber" : "text-faint"}`}>{waiting || "·"}</span>
      </span>
    </div>
  );
}

function DoneSection({ done, intents }: { done: Intent[]; intents: Intent[] }) {
  const gate = PHASES.length - 1;
  const name = intents[0]?.gates[gate]?.name ?? "Outcome confirmed";
  return (
    <div class="mt-2" aria-label="Done">
      <div class="flex items-center gap-2 px-1 py-1.5" title={`${name}: the flag is at 100% and removed from the code`}>
        <span class="h-px flex-1 bg-line-2" />
        <GateGlyph waiting={false} small />
        <span class="font-mono text-[11px] text-faint">{name.toLowerCase()}</span>
        <span class="h-px flex-1 bg-line-2" />
      </div>
      <div class="rounded-lg border border-[color-mix(in_oklab,var(--k-done)_30%,var(--k-line))] bg-[color-mix(in_oklab,var(--k-done)_5%,var(--k-surface))] p-1.5">
        <div class="mb-1 flex items-baseline justify-between px-1">
          <span class="flex items-center gap-1.5 text-[12.5px] font-semibold text-done">
            <Icon name="check" size={13} strokeWidth={2.4} /> Done
          </span>
          <span class="font-mono text-[11.5px] text-muted">{done.length}</span>
        </div>
        <div class="px-1 pb-1 text-[11px] text-faint">Flag at 100% and removed from the code</div>
        <ul class="m-0 flex list-none flex-col p-0">
          {done
            .slice()
            .sort((x, y) => (y.phases.at(-1)?.exitedAt ?? 0) - (x.phases.at(-1)?.exitedAt ?? 0))
            .slice(0, 6)
            .map((i) => (
              <li key={i.id}>
                <a href={hrefIntent(i.id)} class="flex items-center gap-1.5 rounded-md px-1 py-1 text-[12px] text-fg no-underline hover:bg-surface" title={i.title}>
                  <Icon name={i.fastPath ? "zap" : "check"} size={12} class={`flex-none ${i.fastPath ? "text-ink" : "text-done"}`} />
                  <span class="font-mono text-[11px] text-faint">{i.id}</span>
                  <span class="min-w-0 flex-1 truncate">{i.title}</span>
                </a>
              </li>
            ))}
        </ul>
        {done.length > 6 ? (
          <a href="#/backlog" class="mt-0.5 block px-1 text-[12px] font-semibold text-ink no-underline hover:underline">
            All {done.length} shipped
          </a>
        ) : null}
      </div>
    </div>
  );
}
