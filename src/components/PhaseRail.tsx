/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// The phase rail: five phases with a gate between each. A gate is decided by
// a person, skipped by the agent (when p(success) is high and impact low), or
// waiting. The compact form is a row of segments for lists and cards.

import { person } from "../data/org";
import { hours, PHASE_LABEL, PHASE_SHORT, usd } from "../format";
import { now } from "../store";
import { PHASES, type Gate, type Intent, type Phase } from "../types";
import { PersonAvatar } from "./Avatar";
import { Icon } from "./icons";

const idx = (p: Phase) => (p === "done" ? PHASES.length : PHASES.indexOf(p));

export function MiniRail({ intent }: { intent: Intent }) {
  const cur = idx(intent.phase);
  const waiting = intent.status === "waiting-human";
  return (
    <span class="flex items-center gap-[3px]" aria-label={`Phase: ${PHASE_LABEL[intent.phase]}`} role="img">
      {PHASES.map((p, i) => {
        const tone =
          i < cur
            ? "var(--k-done)"
            : i === cur
              ? waiting
                ? "var(--k-amber)"
                : intent.status === "queued"
                  ? "var(--k-line-3)"
                  : "var(--k-accent)"
              : "var(--k-line-2)";
        return (
          <span
            key={p}
            title={PHASE_LABEL[p]}
            class={`block h-[5px] rounded-full ${i === cur ? "w-6" : "w-3.5"}`}
            style={{ background: tone }}
          />
        );
      })}
    </span>
  );
}

function GateMark({ gate }: { gate: Gate }) {
  const base = "relative z-[1] grid size-7 rotate-45 place-items-center rounded-[6px] border";
  let cls = "border-line-2 bg-surface text-faint";
  let icon: "check" | "skip" | "hand" | "lock" | "rotateCcw" = "lock";
  if (gate.state === "approved") {
    cls = "border-done bg-[color-mix(in_oklab,var(--k-done)_16%,var(--k-surface))] text-done";
    icon = "check";
  } else if (gate.state === "auto-skipped") {
    cls = "border-[color-mix(in_oklab,var(--k-accent)_50%,transparent)] bg-surface text-ink";
    icon = "skip";
  } else if (gate.state === "waiting") {
    cls = "border-amber bg-[color-mix(in_oklab,var(--k-amber)_16%,var(--k-surface))] text-amber shadow-[0_0_0_4px_color-mix(in_oklab,var(--k-amber)_14%,transparent)]";
    icon = "hand";
  } else if (gate.state === "changes-requested") {
    cls = "border-amber bg-surface text-amber";
    icon = "rotateCcw";
  }
  return (
    <span class={`${base} ${cls}`}>
      <span class="-rotate-45">
        <Icon name={icon} size={13} strokeWidth={2.2} />
      </span>
    </span>
  );
}

function gateCaption(g: Gate) {
  if (g.state === "approved" && g.decidedBy) return person(g.decidedBy).name.split(" ")[0];
  if (g.state === "auto-skipped") return g.pSuccess !== undefined ? `skipped · p ${g.pSuccess.toFixed(2)}` : "skipped";
  if (g.state === "waiting") return "waiting";
  if (g.state === "changes-requested") return "changes";
  return g.pSuccess !== undefined ? `p ${g.pSuccess.toFixed(2)}` : "";
}

export function PhaseRail({ intent }: { intent: Intent }) {
  const cur = idx(intent.phase);
  return (
    <ol class="m-0 grid list-none grid-cols-[repeat(6,minmax(0,1fr))] gap-0 p-0" aria-label="Phases">
      {PHASES.map((p, i) => {
        const rec = intent.phases.find((r) => r.phase === p);
        const state = i < cur ? "done" : i === cur ? "current" : "future";
        const gate = intent.gates[i];
        const hrs = rec ? ((rec.exitedAt ?? now()) - rec.enteredAt) / 3_600_000 : 0;
        const waiting = state === "current" && intent.status === "waiting-human";
        const queued = state === "current" && intent.status === "queued";
        return (
          <li key={p} class="relative flex items-start">
            <div class="min-w-0 flex-1 pr-3">
              <div class="flex items-center gap-2">
                <span
                  class={`block h-1.5 flex-1 rounded-full ${state === "future" ? "bg-line" : ""}`}
                  style={
                    state === "done"
                      ? { background: "var(--k-done)" }
                      : state === "current"
                        ? { background: waiting ? "var(--k-amber)" : queued ? "var(--k-line-3)" : "var(--k-accent)" }
                        : undefined
                  }
                />
              </div>
              <div class="mt-2.5 flex items-center gap-1.5">
                <span class={`text-[13px] font-semibold ${state === "future" ? "text-faint" : "text-fg"}`}>
                  {PHASE_LABEL[p]}
                </span>
                {state === "current" && !queued ? <span class={waiting ? "k-live-dot k-live-dot--amber" : "k-live-dot"} /> : null}
              </div>
              <div class="mt-0.5 font-mono text-[11.5px] text-muted">
                {rec ? (
                  <>
                    {hours(hrs)}
                    {rec.costUsd > 0 ? ` · ${usd(rec.costUsd)}` : ""}
                    {rec.hilCount > 0 ? ` · ${rec.hilCount} HIL` : ""}
                  </>
                ) : (
                  <span class="text-faint">—</span>
                )}
              </div>
              {queued ? <div class="mt-0.5 text-[11.5px] text-amber">queued</div> : null}
            </div>
            {gate ? (
              <div class={`absolute top-[-33px] right-[-14px] flex w-7 flex-col ${i === PHASES.length - 1 ? "items-end" : "items-center"}`} title={`${gate.name}: ${gate.state}${gate.why ? ` — ${gate.why}` : ""}`}>
                <span class={`mb-1.5 h-[15px] text-center font-mono text-[10.5px] leading-[15px] whitespace-nowrap ${gate.state === "waiting" ? "text-amber" : "text-faint"}`}>
                  {gateCaption(gate)}
                </span>
                <GateMark gate={gate} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function GateRow({ gate }: { gate: Gate }) {
  return (
    <div class="flex items-start gap-3 py-2">
      <span class="mt-0.5 scale-[0.8]">
        <GateMark gate={gate} />
      </span>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 text-[13.5px]">
          <strong class="font-semibold">{gate.name}</strong>
          <span class="font-mono text-[11.5px] text-faint">
            {PHASE_SHORT[gate.from]} → {PHASE_SHORT[gate.to]}
          </span>
        </div>
        <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
          {gate.state === "approved" && gate.decidedBy ? (
            <>
              <PersonAvatar id={gate.decidedBy} size={16} /> approved by {person(gate.decidedBy).name}
            </>
          ) : gate.state === "auto-skipped" ? (
            <>
              Skipped by the agent · p(success) {gate.pSuccess?.toFixed(2)} · impact {gate.impact}
            </>
          ) : gate.state === "waiting" ? (
            <span class="text-amber">Waiting for a person</span>
          ) : gate.pSuccess !== undefined ? (
            <>
              Forecast p(success) {gate.pSuccess.toFixed(2)} · impact {gate.impact}
            </>
          ) : (
            "Upcoming"
          )}
        </div>
        {gate.why ? <div class="mt-0.5 text-[12.5px] text-faint">{gate.why}</div> : null}
      </div>
    </div>
  );
}
