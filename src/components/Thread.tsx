/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// The conversation on an intent: agents and people in one thread, with
// structured cards where a structured answer is needed. A question card is
// modelled on Claude Code's own interruptions (a header chip, the question,
// numbered options with one recommended, an optional side-by-side preview, and
// "Other" for anything else). A gate card is the HIL checkpoint between
// phases. Everything said here is written to ktiro-intents as markdown.

import { useState } from "preact/hooks";
import { agent, person } from "../data/org";
import { ago, PHASE_SHORT } from "../format";
import { answerQuestion, decideGate, sendMessage, useMe, useStore } from "../store";
import type { Assignment, Card, Intent, Message } from "../types";
import { AgentAvatar, PersonAvatar, SpeakerAvatar, speakerName } from "./Avatar";
import { EvidenceStrip } from "./Evidence";
import { Icon } from "./icons";
import { Markdown } from "./Markdown";
import { hrefIntent } from "../router";
import { highlight } from "../highlight";

const MATCH_LABEL: Record<Assignment["match"], string> = {
  author: "author",
  skill: "skill match",
  interest: "interest",
  stretch: "stretch",
  owner: "decision owner",
};

export function Assignees({ list }: { list: Assignment[] }) {
  return (
    <div class="flex flex-wrap gap-x-4 gap-y-1.5">
      {list.map((a) => (
        <span key={a.person} class="inline-flex items-center gap-1.5 text-[12.5px] text-muted" title={a.detail}>
          <PersonAvatar id={a.person} size={18} />
          <span class="text-fg">{person(a.person).name}</span>
          <span class={`k-pill ${a.match === "stretch" ? "k-pill--feat" : "k-pill--neutral"} !py-0 !text-[11px]`}>{MATCH_LABEL[a.match]}</span>
        </span>
      ))}
    </div>
  );
}

const TRIGGER_TEXT = {
  "decision-branch": "Stopped at a decision branch",
  "low-confidence": "Stopped: not confident enough to continue",
  gate: "Gate",
  clarification: "Needs a clarification",
  "new-adr": "A net-new ADR needs a person to agree",
} as const;

export function QuestionCard({ intent, msg, card }: { intent: Intent; msg: Message; card: Extract<Card, { type: "question" }> }) {
  const me = useMe();
  const q = card.question;
  const [sel, setSel] = useState<number>(Math.max(0, q.options.findIndex((o) => o.recommended)));
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const mine = card.assigned.some((a) => a.person === me);
  const hasPreview = q.options.some((o) => o.preview);

  if (card.answer) {
    return (
      <div class="k-card mt-2 overflow-hidden">
        <div class="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5">
          <span class="k-chip !py-0.5">{q.header}</span>
          <span class="text-[13.5px] font-semibold">{q.prompt}</span>
        </div>
        <div class="flex items-center gap-2.5 px-4 py-3 text-[13.5px]">
          <span class="grid size-5 place-items-center rounded-full bg-done text-onaccent">
            <Icon name="check" size={12} strokeWidth={2.6} />
          </span>
          <strong>{card.answer.label}</strong>
          <span class="text-muted">· answered by {person(card.answer.by).name}</span>
        </div>
        {card.answer.note ? <p class="m-0 border-t border-line px-4 py-2.5 text-[13px] text-muted">"{card.answer.note}"</p> : null}
      </div>
    );
  }

  const chosen = sel === q.options.length ? other.trim() : q.options[sel]?.label;
  return (
    <div class={`k-card mt-2 overflow-hidden ${mine ? "border-amber shadow-[0_0_0_3px_color-mix(in_oklab,var(--k-amber)_12%,transparent)]" : ""}`}>
      <div class="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5">
        <Icon name="messageQuestion" size={15} class="text-amber" />
        <span class="text-[12.5px] font-semibold text-amber">{TRIGGER_TEXT[q.trigger]}</span>
        {q.confidence !== undefined ? <span class="font-mono text-[11.5px] text-faint">confidence {q.confidence.toFixed(2)}</span> : null}
        {q.context ? <span class="k-mono-tag ml-auto !text-[11px]">{q.context}</span> : null}
      </div>
      <div class="p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="k-chip !py-0.5">{q.header}</span>
          <h4 class="m-0 text-[15px] font-bold">{q.prompt}</h4>
        </div>
        <div class={`mt-3 grid gap-3 ${hasPreview ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]" : ""}`}>
          <div class="flex flex-col gap-2" role="radiogroup" aria-label={q.prompt}>
            {q.options.map((o, i) => (
              <button key={o.label} type="button" role="radio" aria-checked={sel === i} class={`k-option ${sel === i ? "is-selected" : ""}`} onClick={() => setSel(i)}>
                <span class="k-option__radio font-mono text-[10.5px]">{sel === i ? <Icon name="check" size={11} strokeWidth={3} /> : i + 1}</span>
                <span class="min-w-0">
                  <span class="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
                    {o.label}
                    {o.recommended ? <span class="k-pill k-pill--accent !py-0 !text-[10.5px]">recommended</span> : null}
                  </span>
                  <span class="mt-0.5 block text-[12.5px] leading-relaxed text-muted">{o.description}</span>
                </span>
              </button>
            ))}
            <div class={`k-option !cursor-default ${sel === q.options.length ? "is-selected" : ""}`} onClick={() => setSel(q.options.length)}>
              <span class="k-option__radio font-mono text-[10.5px]">{sel === q.options.length ? <Icon name="check" size={11} strokeWidth={3} /> : q.options.length + 1}</span>
              <input
                class="w-full border-0 bg-transparent p-0 text-[13.5px] text-fg outline-none placeholder:text-faint"
                placeholder="Other: tell the agent what to do instead…"
                value={other}
                onFocus={() => setSel(q.options.length)}
                onInput={(e) => setOther((e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
          {hasPreview ? (
            <pre class="hljs m-0 min-h-[140px] overflow-auto rounded-lg border border-line bg-code p-3 font-mono text-[12px] leading-relaxed text-fg">
              {q.options[sel]?.preview ? highlight(q.options[sel].preview!, q.options[sel].previewLang) : "No preview for this option."}
            </pre>
          ) : null}
        </div>
        <textarea
          class="k-input mt-3 min-h-[60px] text-[13px]"
          placeholder="Add a note for the agent (optional). It's kept with the decision."
          value={note}
          onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)}
        />
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" class="k-btn k-btn--primary" disabled={!chosen} onClick={() => chosen && answerQuestion(intent.id, msg.id, chosen, note.trim() || undefined)}>
            <Icon name="send" size={14} /> Answer
          </button>
          <div class="ml-auto">
            <span class="k-label mr-2">Asked of</span>
            <Assignees list={card.assigned} />
          </div>
        </div>
        {!mine ? <p class="mt-2 mb-0 text-[12px] text-faint">You're not assigned to this one. Anyone can answer, but the assignees were matched on skills and interests.</p> : null}
      </div>
    </div>
  );
}

export function GateCard({ intent, msg, card }: { intent: Intent; msg: Message; card: Extract<Card, { type: "gate" }> }) {
  const me = useMe();
  const [note, setNote] = useState("");
  const mine = card.assigned.some((a) => a.person === me);
  if (card.decision) {
    const ok = card.decision.result === "approved";
    return (
      <div class="mt-2 flex flex-wrap items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13.5px]">
        <span class={`grid size-5 rotate-45 place-items-center rounded-[4px] ${ok ? "bg-done" : "bg-amber"} text-onaccent`}>
          <span class="-rotate-45">
            <Icon name={ok ? "check" : "rotateCcw"} size={11} strokeWidth={2.6} />
          </span>
        </span>
        <strong>{card.gate}</strong>
        <span class="text-muted">
          {ok ? "approved" : "changes requested"} by {person(card.decision.by).name}
        </span>
        {card.decision.note ? <span class="text-muted">· "{card.decision.note}"</span> : null}
      </div>
    );
  }
  return (
    <div class={`k-card mt-2 overflow-hidden ${mine ? "border-amber shadow-[0_0_0_3px_color-mix(in_oklab,var(--k-amber)_12%,transparent)]" : ""}`}>
      <div class="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5">
        <Icon name="hand" size={15} class="text-amber" />
        <span class="text-[12.5px] font-semibold text-amber">Gate · a person decides</span>
      </div>
      <div class="p-4">
        <h4 class="m-0 text-[15px] font-bold">{card.gate}</h4>
        <p class="mt-1 mb-0 text-[13.5px] text-muted">{card.summary}</p>
        <textarea
          class="k-input mt-3 min-h-[56px] text-[13px]"
          placeholder="Feedback (required to request changes; optional to approve)"
          value={note}
          onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)}
        />
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" class="k-btn k-btn--primary" onClick={() => decideGate(intent.id, msg.id, "approved", note.trim() || undefined)}>
            <Icon name="check" size={14} /> {card.gate === "Results accepted" ? "Accept results" : "Approve"}
          </button>
          <button type="button" class="k-btn" disabled={!note.trim()} onClick={() => decideGate(intent.id, msg.id, "changes-requested", note.trim())}>
            <Icon name="rotateCcw" size={14} /> Request changes
          </button>
          <div class="ml-auto">
            <span class="k-label mr-2">Assigned</span>
            <Assignees list={card.assigned} />
          </div>
        </div>
      </div>
    </div>
  );
}

const TONE_CLASS = {
  done: "text-done",
  accent: "text-ink",
  amber: "text-amber",
  red: "text-red",
  neutral: "text-muted",
} as const;

function EventRow({ msg, card }: { msg: Message; card: Extract<Card, { type: "event" }> }) {
  return (
    <div class="flex items-start gap-3 py-1.5 pl-[7px]">
      <span class={`mt-px grid size-[22px] flex-none place-items-center rounded-full border border-line bg-surface ${TONE_CLASS[card.tone ?? "neutral"]}`}>
        <Icon name={card.icon} size={12} strokeWidth={2.2} />
      </span>
      <div class="min-w-0 flex-1 text-[13px] text-muted">
        {msg.body ? <Markdown src={msg.body} class="mb-1 !text-[13.5px] text-fg" /> : null}
        <span class={TONE_CLASS[card.tone ?? "neutral"]}>{card.text}</span>
        <span class="ml-2 font-mono text-[11px] text-faint">
          {msg.from.kind === "agent" ? `${agent(msg.from.id).name} · ` : ""}
          {ago(msg.at)}
        </span>
      </div>
    </div>
  );
}

export function MessageView({ intent, msg }: { intent: Intent; msg: Message }) {
  const card = msg.card;
  if (card?.type === "event") return <EventRow msg={msg} card={card} />;
  const isAgent = msg.from.kind === "agent";
  return (
    <div class="flex animate-rise gap-3 py-2.5">
      <SpeakerAvatar from={msg.from} size={30} />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-baseline gap-x-2">
          <strong class="text-[13.5px]">{speakerName(msg.from)}</strong>
          {isAgent ? <span class="font-mono text-[11px] text-faint">agent</span> : null}
          <span class="font-mono text-[11px] text-faint">
            {PHASE_SHORT[msg.phase]} · {ago(msg.at)}
          </span>
        </div>
        {msg.body ? <Markdown src={msg.body} class="mt-1" /> : null}
        {card?.type === "question" ? <QuestionCard intent={intent} msg={msg} card={card} /> : null}
        {card?.type === "gate" ? <GateCard intent={intent} msg={msg} card={card} /> : null}
        {card?.type === "evidence" ? (
          <div class="mt-2">
            <EvidenceStrip items={(intent.evidence ?? []).filter((e) => card.ids.includes(e.id))} />
          </div>
        ) : null}
        {card?.type === "plan" ? (
          <a href={hrefIntent(intent.id, "plan")} class="k-btn k-btn--sm mt-2">
            <Icon name="layers" size={13} /> Open the plan
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function Thread({ intent, filter }: { intent: Intent; filter?: (m: Message) => boolean }) {
  const thinking = useStore((s) => s.thinking[intent.id]);
  const [text, setText] = useState("");
  const msgs = filter ? intent.messages.filter(filter) : intent.messages;
  return (
    <div>
      <div class="divide-y divide-transparent">
        {msgs.map((m) => (
          <MessageView key={m.id} intent={intent} msg={m} />
        ))}
        {thinking ? (
          <div class="flex items-center gap-3 py-2.5">
            <AgentAvatar id={thinking} size={30} />
            <span class="text-[13px] text-muted">{agent(thinking).name} is working</span>
            <span class="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} class="k-live-dot !size-[5px]" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </span>
          </div>
        ) : null}
      </div>
      {intent.phase !== "done" ? (
        <form
          class="mt-4 flex items-end gap-2 rounded-[10px] border border-line-3 bg-surface p-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            sendMessage(intent.id, text.trim());
            setText("");
          }}
        >
          <textarea
            class="min-h-[38px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-[14px] text-fg outline-none placeholder:text-faint"
            rows={1}
            placeholder="Message the orchestrator about this intent…"
            value={text}
            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement).requestSubmit();
              }
            }}
          />
          <button type="submit" class="k-btn k-btn--primary k-btn--sm" disabled={!text.trim()}>
            <Icon name="send" size={13} /> Send
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** Every open question or gate, across intents, that a person is assigned to. */
export function openAsks(intents: Intent[], who: string) {
  const out: { intent: Intent; msg: Message; card: Extract<Card, { type: "question" | "gate" }>; assignment: Assignment }[] = [];
  for (const intent of intents) {
    for (const msg of intent.messages) {
      const c = msg.card;
      if (!c) continue;
      if ((c.type === "question" && !c.answer) || (c.type === "gate" && !c.decision)) {
        const a = c.assigned.find((x) => x.person === who);
        if (a) out.push({ intent, msg, card: c, assignment: a });
      }
    }
  }
  return out;
}
