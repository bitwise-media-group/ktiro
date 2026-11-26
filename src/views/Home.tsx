/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// My work: everything in flight that I authored, contributed to (gave HIL
// input on), or am assigned to, with what needs me right now at the top.

import { useState } from "preact/hooks";
import { agent, person, TENANT } from "../data/org";
import { PersonAvatar } from "../components/Avatar";
import { Icon } from "../components/icons";
import { MiniRail } from "../components/PhaseRail";
import { KindPill, StatusPill, ValueTag } from "../components/Pills";
import { openAsks } from "../components/Thread";
import { ago, hours, money, PHASE_LABEL, sum, usd } from "../format";
import { activeIn } from "../priority";
import { hrefIntent } from "../router";
import { now, useMe, useStore } from "../store";
import { PHASES, type Intent } from "../types";

type Filter = "all" | "authored" | "contributed" | "assigned";

function greeting() {
  const h = new Date(now()).getUTCHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function HomeView() {
  const me = useMe();
  const intents = useStore((s) => s.intents);
  const p = person(me);
  const asks = openAsks(intents, me);
  const assignedIds = new Set(asks.map((a) => a.intent.id));
  const live = intents.filter((i) => i.phase !== "done");
  const groups = {
    authored: live.filter((i) => i.author === me),
    contributed: live.filter((i) => i.contributors.includes(me)),
    assigned: live.filter((i) => assignedIds.has(i.id)),
  };
  const mine = live.filter((i) => i.author === me || i.contributors.includes(me) || assignedIds.has(i.id));
  const [filter, setFilter] = useState<Filter>("all");
  const rows = filter === "all" ? mine : groups[filter];
  const shipped = intents.filter((i) => i.phase === "done" && (i.author === me || i.contributors.includes(me)));

  return (
    <div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div class="min-w-0">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div class="k-eyebrow">My work</div>
            <h1 class="mt-1 mb-0 text-[26px] leading-tight font-bold tracking-[-0.01em]">
              {greeting()}, {p.name.split(" ")[0]}
            </h1>
            <p class="mt-1.5 mb-0 text-[14.5px] text-muted">
              {asks.length > 0 ? (
                <>
                  <span class="font-semibold text-amber">
                    {asks.length} {asks.length === 1 ? "thing needs" : "things need"} you
                  </span>{" "}
                  · {mine.length} intents you're part of are moving.
                </>
              ) : (
                <>Nothing needs you right now · {mine.length} intents you're part of are moving.</>
              )}
            </p>
          </div>
          <a href="#/new" class="k-btn">
            <Icon name="sparkles" size={15} /> Describe something you want
          </a>
        </div>

        {/* ── Needs you ── */}
        <section class="mt-7" aria-labelledby="needs-you">
          <div class="mb-3 flex items-center gap-2">
            <h2 id="needs-you" class="k-heading">
              Needs you
            </h2>
            <span class={`k-count ${asks.length ? "k-count--amber" : ""}`}>{asks.length}</span>
            <span class="ml-auto text-[12.5px] text-faint">Matched on your skills, interests and availability</span>
          </div>
          {asks.length === 0 ? (
            <div class="k-card k-card--pad flex items-center gap-3 text-muted">
              <span class="grid size-8 place-items-center rounded-full bg-surface-2 text-done">
                <Icon name="check" size={16} />
              </span>
              You're clear. Agents will ask when a decision or a gate needs you.
            </div>
          ) : (
            <div class="grid gap-3 md:grid-cols-2">
              {asks.map(({ intent, msg, card, assignment }) => {
                const asker = msg.from.kind === "agent" ? agent(msg.from.id).name : "ktiro";
                const isQ = card.type === "question";
                const tab = !isQ && intent.phase === "business" ? "business" : isQ && card.question.trigger === "new-adr" ? "technical" : "conversation";
                return (
                  <a
                    key={msg.id}
                    href={`${hrefIntent(intent.id, tab)}`}
                    class="k-card k-card--hover group relative flex flex-col overflow-hidden p-4 text-fg no-underline"
                  >
                    <span class="absolute inset-y-0 left-0 w-[3px] bg-amber" />
                    <div class="flex items-center gap-2 text-[12px]">
                      <Icon name={isQ ? "messageQuestion" : "hand"} size={14} class="text-amber" />
                      <span class="font-semibold text-amber">{isQ ? "Question" : "Gate"}</span>
                      <span class="text-faint">·</span>
                      <span class="font-mono text-faint">
                        {asker} · {ago(msg.at)}
                      </span>
                      <span class="ml-auto">
                        <KindPill kind={intent.kind} compact />
                      </span>
                    </div>
                    <div class="mt-2 text-[15px] leading-snug font-bold">{isQ ? card.question.prompt : card.gate}</div>
                    <div class="mt-1 line-clamp-1 text-[13px] text-muted">
                      <span class="font-mono text-faint">{intent.id}</span> {intent.title}
                    </div>
                    <div class="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[12.5px]">
                      <span class={`k-pill ${assignment.match === "stretch" ? "k-pill--feat" : "k-pill--neutral"} !py-0`}>
                        {assignment.match === "stretch" ? "stretch" : "why you"}
                      </span>
                      <span class="min-w-0 flex-1 truncate text-muted">{assignment.detail}</span>
                      <span class="inline-flex items-center gap-1 font-semibold text-ink group-hover:underline">
                        {isQ ? "Answer" : "Review"} <Icon name="arrowRight" size={13} />
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* ── In flight ── */}
        <section class="mt-9" aria-labelledby="in-flight">
          <div class="mb-3 flex flex-wrap items-center gap-3">
            <h2 id="in-flight" class="k-heading">
              In flight
            </h2>
            <div class="k-seg ml-auto" role="tablist" aria-label="Filter">
              {(["all", "authored", "contributed", "assigned"] as Filter[]).map((f) => (
                <button key={f} type="button" role="tab" aria-selected={filter === f} class={filter === f ? "is-active" : ""} onClick={() => setFilter(f)}>
                  {f === "all" ? "All" : f === "authored" ? "Authored" : f === "contributed" ? "Contributed" : "Assigned"}
                  <span class="font-mono text-[11px] text-faint">{f === "all" ? mine.length : groups[f].length}</span>
                </button>
              ))}
            </div>
          </div>
          <IntentList rows={rows} me={me} assigned={assignedIds} />
        </section>
      </div>

      {/* ── Aside ── */}
      <aside class="flex min-w-0 flex-col gap-4">
        <FactoryNow intents={intents} />
        <div class="k-card k-card--pad">
          <div class="flex items-center justify-between">
            <h3 class="k-heading !text-[14px]">How ktiro matches you</h3>
            <a href="#/welcome" class="text-[12.5px] font-semibold text-ink no-underline hover:underline">
              Edit
            </a>
          </div>
          <div class="mt-3 k-label">Skills</div>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            {p.skills.map((s) => (
              <span key={s.name} class="k-chip !py-0.5 !text-[11.5px]">
                {s.name}
                <span class="text-faint">{"●".repeat(s.level)}</span>
              </span>
            ))}
          </div>
          <div class="mt-3 k-label">Wants to grow into</div>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            {p.interests.map((s) => (
              <span key={s} class="k-pill k-pill--feat !text-[11.5px]">
                {s}
              </span>
            ))}
          </div>
          <div class="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[12.5px] text-muted">
            <Icon name="calendar" size={14} />
            {p.availability.hoursPerWeek}h/week · {p.availability.window} {p.availability.timezone.split("/")[1]?.replace("_", " ")}
          </div>
          <div class="mt-1.5 flex items-center gap-2 text-[12.5px] text-muted">
            <Icon name="compass" size={14} />
            Up to {Math.round(p.stretch * 100)}% stretch assignments
          </div>
        </div>
        {shipped.length > 0 ? (
          <div class="k-card k-card--pad">
            <h3 class="k-heading !text-[14px]">Shipped, with your hands on it</h3>
            <ul class="m-0 mt-2 list-none p-0">
              {shipped.map((i) => (
                <li key={i.id} class="border-t border-line py-2 first:border-t-0">
                  <a href={hrefIntent(i.id)} class="flex items-center gap-2 text-[13px] text-fg no-underline hover:text-ink">
                    <Icon name="check" size={13} class="text-done" />
                    <span class="min-w-0 flex-1 truncate">{i.title}</span>
                    <span class="font-mono text-[11.5px] text-done">{money(i.value.amount, { sign: true })}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export function IntentList({ rows, me, assigned }: { rows: Intent[]; me?: string; assigned?: Set<string> }) {
  if (rows.length === 0) return <div class="k-card k-card--pad text-muted">Nothing here yet.</div>;
  return (
    <div class="k-card divide-y divide-line overflow-hidden">
      {rows.map((i) => {
        const spent = sum(i.phases.map((p) => p.costUsd));
        const age = (now() - i.createdAt) / 3_600_000;
        const role = me ? (i.author === me ? "author" : assigned?.has(i.id) ? "assigned" : i.contributors.includes(me) ? "contributor" : null) : null;
        return (
          <a key={i.id} href={hrefIntent(i.id)} class="grid gap-x-4 gap-y-2 px-4 py-3.5 text-fg no-underline transition-colors hover:bg-[color-mix(in_oklab,var(--k-accent)_4%,var(--k-surface))] md:grid-cols-[minmax(0,1fr)_200px_150px]">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-mono text-[12px] text-faint">{i.id}</span>
                <span class="truncate text-[14px] font-semibold">{i.title}</span>
              </div>
              <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                <KindPill kind={i.kind} />
                <StatusPill intent={i} />
                {role ? <span class="k-pill k-pill--neutral">{role}</span> : null}
                {i.origin ? (
                  <span class="k-pill k-pill--neutral" title={`Raised by ${agent(i.origin).name}`}>
                    <Icon name="bot" size={11} /> {agent(i.origin).name}
                  </span>
                ) : null}
              </div>
            </div>
            <div class="min-w-0">
              <MiniRail intent={i} />
              <div class="mt-1.5 text-[12.5px] font-semibold">{PHASE_LABEL[i.phase]}</div>
              <div class="truncate text-[12px] text-muted" title={i.statusText}>
                {i.statusText}
              </div>
            </div>
            <div class="flex flex-row items-center gap-3 md:flex-col md:items-end md:gap-1">
              <ValueTag amount={i.value.amount} />
              <span class="font-mono text-[11.5px] text-faint">
                {hours(age)} · {usd(spent)}
              </span>
              <span class="flex items-center gap-1 text-[11.5px] text-faint md:hidden">
                <PersonAvatar id={i.author} size={16} />
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function FactoryNow({ intents }: { intents: Intent[] }) {
  return (
    <a href="#/flow" class="k-card k-card--pad k-card--hover block text-fg no-underline">
      <div class="flex items-center justify-between">
        <h3 class="k-heading !text-[14px]">The factory right now</h3>
        <Icon name="arrowRight" size={14} class="text-muted" />
      </div>
      <p class="mt-1 mb-3 text-[12.5px] text-muted">Work in flight per phase, against its limit.</p>
      <div class="flex flex-col gap-2.5">
        {PHASES.map((ph) => {
          const n = activeIn(intents, ph).length;
          const lim = TENANT.wip[ph];
          const q = intents.filter((i) => i.phase === ph && i.status === "queued").length;
          const waiting = intents.filter((i) => i.phase === ph && i.status === "waiting-human").length;
          return (
            <div key={ph}>
              <div class="flex items-center justify-between text-[12.5px]">
                <span class="font-semibold">{PHASE_LABEL[ph]}</span>
                <span class="font-mono text-muted">
                  {n}/{lim}
                  {q ? <span class="text-faint"> · {q} queued</span> : null}
                </span>
              </div>
              <div class="mt-1 flex gap-[3px]">
                {Array.from({ length: lim }, (_, k) => (
                  <span
                    key={k}
                    class="h-[6px] flex-1 rounded-full"
                    style={{
                      background: k < waiting ? "var(--k-amber)" : k < n ? "var(--k-accent)" : "var(--k-line)",
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div class="mt-3 flex items-center gap-3 border-t border-line pt-3 text-[11.5px] text-muted">
        <span class="flex items-center gap-1.5">
          <span class="k-swatch bg-accent" /> agents working
        </span>
        <span class="flex items-center gap-1.5">
          <span class="k-swatch bg-amber" /> waiting on a person
        </span>
      </div>
    </a>
  );
}
