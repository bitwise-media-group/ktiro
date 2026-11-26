/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// Personal onboarding: a person describes what they're good at, what they want
// to grow into, and when they're around. ktiro uses it to match HIL questions,
// gates and reviews to people, including a share of stretch work outside their
// expertise. The last step previews what ktiro would hand them today.
//
// Local state only: the prototype prefills from the current persona and keeps
// edits on this page.

import { useState } from "preact/hooks";
import { PersonAvatar } from "../components/Avatar";
import { Icon, type IconName } from "../components/icons";
import { KindPill } from "../components/Pills";
import { openAsks } from "../components/Thread";
import { PEOPLE, person, REPOS } from "../data/org";
import { PHASE_LABEL } from "../format";
import { hrefIntent } from "../router";
import { useMe, useStore } from "../store";
import type { Intent, Skill } from "../types";

const STEPS: { title: string; icon: IconName; blurb: string }[] = [
  { title: "Skills", icon: "cpu", blurb: "What you're good at, and how deep it goes." },
  { title: "Interests", icon: "compass", blurb: "What you'd like to grow into." },
  { title: "Availability", icon: "calendar", blurb: "When ktiro can ask you for something." },
  { title: "Stretch & notices", icon: "sliders", blurb: "How far outside your expertise, and how you hear about it." },
  { title: "Your first work", icon: "inbox", blurb: "What ktiro would hand you today." },
];

const DEPTH = ["", "Familiar", "Proficient", "Expert"];

const ZONES = ["Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const INTEREST_SUGGESTIONS = [
  "Frontend accessibility",
  "Observability",
  "Data integrity",
  "Double-entry ledgers",
  "Design systems",
  "Billing domain",
  "Experimentation",
  "Data pipelines",
  "Payments",
  "Pricing & packaging",
  "Threat modelling",
];

/** What a skill or interest means in terms of repositories and kinds of work. */
const AFFINITY: Record<string, { repos?: string[]; kinds?: Intent["kind"][] }> = {
  Go: { repos: REPOS.filter((r) => r.archetype === "go").map((r) => r.name) },
  PostgreSQL: { repos: ["ledger-api", "payments-gateway"], kinds: ["data-integrity"] },
  "Double-entry ledgers": { repos: ["ledger-api", "billing-engine"], kinds: ["data-integrity"] },
  "Data integrity": { kinds: ["data-integrity"] },
  Payments: { repos: ["payments-gateway"] },
  Kubernetes: { repos: ["platform"] },
  "Flux & Flagger": { repos: ["platform"] },
  Observability: { repos: ["platform"] },
  "Pricing & packaging": { repos: ["billing-engine"] },
  "Billing domain": { repos: ["billing-engine", "invoice-renderer"] },
  "UX writing": { repos: ["customer-portal", "notifications"] },
  "Product design": { repos: ["customer-portal", "invoice-renderer"] },
  Accessibility: { repos: ["customer-portal"] },
  "Frontend accessibility": { repos: ["customer-portal"] },
  "Design systems": { repos: ["customer-portal"] },
  TypeScript: { repos: ["customer-portal", "invoice-renderer"] },
  "Application security": { kinds: ["security"] },
  "Threat modelling": { kinds: ["security"] },
  "OAuth / OIDC": { kinds: ["security"] },
  Python: { repos: ["data-pipeline"] },
  "Data pipelines": { repos: ["data-pipeline"] },
  SQL: { repos: ["data-pipeline"] },
  Experimentation: { repos: ["data-pipeline"] },
};

function matches(i: Intent, topic: string) {
  const a = AFFINITY[topic];
  if (!a) return false;
  return (a.repos ?? []).some((r) => i.repos.includes(r)) || (a.kinds ?? []).includes(i.kind);
}

export function WelcomeView() {
  const me = useMe();
  // Re-key on persona so switching "preview as" re-prefills the form.
  return <Onboarding key={me} me={me} />;
}

function Onboarding({ me }: { me: string }) {
  const p = person(me);
  const intents = useStore((s) => s.intents);
  const [step, setStep] = useState(0);
  const [skills, setSkills] = useState<Skill[]>(p.skills);
  const [interests, setInterests] = useState<string[]>(p.interests);
  const [hours, setHours] = useState(p.availability.hoursPerWeek);
  const [zone, setZone] = useState(p.availability.timezone);
  const [window, setWindow] = useState(p.availability.window);
  const [days, setDays] = useState<string[]>(DAYS);
  const [stretch, setStretch] = useState(Math.round(p.stretch * 100));
  const [notify, setNotify] = useState({ asks: "ktiro + Slack", digest: true, live: true, shipped: true, mentions: true });
  const [newSkill, setNewSkill] = useState("");
  const [newInterest, setNewInterest] = useState("");

  const allSkills = Array.from(new Set(PEOPLE.flatMap((x) => x.skills.map((s) => s.name)))).filter((n) => !skills.some((s) => s.name === n));

  return (
    <div>
      <div class="flex flex-wrap items-end gap-4">
        <PersonAvatar id={me} size={48} />
        <div>
          <div class="k-eyebrow">Welcome to ktiro</div>
          <h1 class="mt-1 mb-0 text-[26px] leading-tight font-bold tracking-[-0.01em]">Tell ktiro how to work with you, {p.name.split(" ")[0]}</h1>
          <p class="mt-1.5 mb-0 max-w-[70ch] text-[14.5px] text-muted">
            Agents do the work and stop to ask when they need a person. This is how ktiro decides who to ask. It measures intents, never people.
          </p>
        </div>
      </div>

      <div class="mt-7 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Stepper step={step} setStep={setStep} />

        <div class="min-w-0">
          <div class="k-card p-5 sm:p-6">
            <div class="flex items-center gap-2">
              <Icon name={STEPS[step].icon} size={18} class="text-ink" />
              <h2 class="k-heading !text-[17px]">{STEPS[step].title}</h2>
            </div>
            <p class="mt-1 mb-5 text-[13.5px] text-muted">{STEPS[step].blurb}</p>

            {step === 0 ? (
              <div>
                <ul class="m-0 flex list-none flex-col gap-2 p-0">
                  {skills.map((s, k) => (
                    <li key={s.name} class="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-2.5">
                      <span class="min-w-[160px] flex-1 text-[14px] font-semibold">{s.name}</span>
                      <div class="k-seg" role="radiogroup" aria-label={`${s.name} depth`}>
                        {[1, 2, 3].map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            role="radio"
                            aria-checked={s.level === lvl}
                            class={s.level === lvl ? "is-active" : ""}
                            onClick={() => setSkills(skills.map((x, j) => (j === k ? { ...x, level: lvl as Skill["level"] } : x)))}
                          >
                            <span class="font-mono text-[10px] text-faint">{"●".repeat(lvl)}</span> {DEPTH[lvl]}
                          </button>
                        ))}
                      </div>
                      <button type="button" class="k-btn k-btn--ghost k-btn--sm !px-1.5" aria-label={`Remove ${s.name}`} onClick={() => setSkills(skills.filter((_, j) => j !== k))}>
                        <Icon name="x" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  class="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = newSkill.trim();
                    if (n && !skills.some((s) => s.name === n)) setSkills([...skills, { name: n, level: 1 }]);
                    setNewSkill("");
                  }}
                >
                  <input class="k-input" placeholder="Add a skill" value={newSkill} onInput={(e) => setNewSkill((e.target as HTMLInputElement).value)} />
                  <button type="submit" class="k-btn" disabled={!newSkill.trim()}>
                    <Icon name="plus" size={14} /> Add
                  </button>
                </form>
                {allSkills.length ? (
                  <div class="mt-3 flex flex-wrap items-center gap-1.5">
                    <span class="k-label mr-1">Others here have</span>
                    {allSkills.map((n) => (
                      <button key={n} type="button" class="k-chip cursor-pointer hover:border-accent hover:text-fg" onClick={() => setSkills([...skills, { name: n, level: 1 }])}>
                        <Icon name="plus" size={11} /> {n}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div class="k-note k-note--accent mt-5">
                  <Icon name="lightbulb" size={15} class="mt-0.5 flex-none" />
                  <span class="text-fg">Be honest about depth. Expert questions go to experts; "familiar" means you can review results, not make the call alone.</span>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div>
                <div class="flex flex-wrap gap-2">
                  {Array.from(new Set([...INTEREST_SUGGESTIONS, ...interests])).map((n) => {
                    const on = interests.includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={on}
                        class={`k-pill cursor-pointer !px-3 !py-1 !text-[12.5px] ${on ? "k-pill--feat" : "k-pill--neutral"}`}
                        onClick={() => setInterests(on ? interests.filter((x) => x !== n) : [...interests, n])}
                      >
                        {on ? <Icon name="check" size={12} /> : <Icon name="plus" size={12} />} {n}
                      </button>
                    );
                  })}
                </div>
                <form
                  class="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = newInterest.trim();
                    if (n && !interests.includes(n)) setInterests([...interests, n]);
                    setNewInterest("");
                  }}
                >
                  <input class="k-input" placeholder="Something else you want to learn" value={newInterest} onInput={(e) => setNewInterest((e.target as HTMLInputElement).value)} />
                  <button type="submit" class="k-btn" disabled={!newInterest.trim()}>
                    <Icon name="plus" size={14} /> Add
                  </button>
                </form>
                <p class="mt-4 mb-0 text-[13px] text-muted">
                  Interests drive stretch assignments: low-risk reviews and questions in areas you want to grow into, always alongside someone who knows the area.
                </p>
              </div>
            ) : null}

            {step === 2 ? (
              <div class="grid gap-5 sm:grid-cols-2">
                <label class="block">
                  <span class="k-label">Hours a week for ktiro</span>
                  <div class="mt-2 flex items-center gap-3">
                    <input type="range" min={0} max={40} value={hours} class="flex-1 accent-accent" onInput={(e) => setHours(Number((e.target as HTMLInputElement).value))} />
                    <span class="w-12 text-right font-mono text-[15px] font-bold">{hours}h</span>
                  </div>
                  <span class="mt-1 block text-[12px] text-faint">Answering questions, deciding gates, reviewing results.</span>
                </label>
                <label class="block">
                  <span class="k-label">Time zone</span>
                  <select class="k-input mt-2" value={zone} onChange={(e) => setZone((e.target as HTMLSelectElement).value)}>
                    {Array.from(new Set([zone, ...ZONES])).map((z) => (
                      <option key={z} value={z}>
                        {z.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label class="block">
                  <span class="k-label">Focus window (when you'd rather be asked)</span>
                  <input class="k-input mt-2" value={window} onInput={(e) => setWindow((e.target as HTMLInputElement).value)} />
                </label>
                <div>
                  <span class="k-label">Days</span>
                  <div class="k-seg mt-2">
                    {DAYS.map((d) => (
                      <button key={d} type="button" aria-pressed={days.includes(d)} class={days.includes(d) ? "is-active" : ""} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div class="k-note k-note--accent sm:col-span-2">
                  <Icon name="clock" size={15} class="mt-0.5 flex-none" />
                  <span class="text-fg">
                    Outside your window, ktiro routes to someone else who matches, or waits. Time an intent spends waiting on people is measured per intent, never per person.
                  </span>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div class="flex flex-col gap-6">
                <div>
                  <span class="k-label">Stretch appetite: share of your assignments that may be outside your expertise</span>
                  <div class="mt-2 flex items-center gap-3">
                    <input type="range" min={0} max={50} step={5} value={stretch} class="flex-1 accent-accent" onInput={(e) => setStretch(Number((e.target as HTMLInputElement).value))} />
                    <span class="w-12 text-right font-mono text-[15px] font-bold">{stretch}%</span>
                  </div>
                  <span class="mt-1 block text-[12px] text-faint">
                    {stretch === 0 ? "Only work that matches your skills." : `About ${Math.max(1, Math.round((hours * stretch) / 100))}h a week on things you want to learn, never as the only reviewer.`}
                  </span>
                </div>
                <div>
                  <span class="k-label">When an agent asks you something</span>
                  <div class="k-seg mt-2">
                    {["ktiro only", "ktiro + Slack", "ktiro + email"].map((x) => (
                      <button key={x} type="button" class={notify.asks === x ? "is-active" : ""} onClick={() => setNotify({ ...notify, asks: x })}>
                        {x}
                      </button>
                    ))}
                  </div>
                </div>
                <div class="flex flex-col gap-2">
                  {(
                    [
                      ["digest", "A morning digest of what's waiting and what moved"],
                      ["live", "When something I'm reviewing is live behind its flag for business review"],
                      ["shipped", "When an intent I authored or contributed to is done: flag at 100% and removed"],
                      ["mentions", "When someone mentions me in a conversation"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} class="flex cursor-pointer items-center gap-2.5 text-[14px]">
                      <input type="checkbox" class="size-4 accent-accent" checked={notify[key]} onChange={() => setNotify({ ...notify, [key]: !notify[key] })} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {step === 4 ? <FirstWork me={me} intents={intents} skills={skills} interests={interests} hours={hours} stretch={stretch} /> : null}

            <div class="mt-7 flex items-center gap-2 border-t border-line pt-4">
              <button type="button" class="k-btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
                <Icon name="arrowLeft" size={14} /> Back
              </button>
              <span class="ml-auto font-mono text-[12px] text-faint">
                {step + 1} / {STEPS.length}
              </span>
              {step < STEPS.length - 1 ? (
                <button type="button" class="k-btn k-btn--primary" onClick={() => setStep(step + 1)}>
                  Continue <Icon name="arrowRight" size={14} />
                </button>
              ) : (
                <a href="#/" class="k-btn k-btn--primary">
                  <Icon name="check" size={14} /> Done, take me to my work
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Stepper({ step, setStep, steps = STEPS }: { step: number; setStep: (n: number) => void; steps?: { title: string; icon: IconName; blurb: string }[] }) {
  return (
    <ol class="m-0 flex list-none flex-row gap-1 overflow-x-auto p-0 lg:flex-col lg:gap-0">
      {steps.map((s, k) => {
        const state = k < step ? "done" : k === step ? "current" : "future";
        return (
          <li key={s.title} class="k-tl__item flex-none !min-h-0 lg:!min-h-[56px]">
            <button type="button" class="flex cursor-pointer items-start gap-3 border-0 bg-transparent p-0 text-left" onClick={() => setStep(k)}>
              <span
                class={`k-tl__marker ${state === "done" ? "!border-done !bg-done !text-onaccent" : state === "current" ? "!border-accent !bg-accent !text-onaccent" : ""}`}
                style={state === "current" ? { boxShadow: "0 0 0 5px color-mix(in oklab, var(--k-accent) 14%, transparent)" } : undefined}
              >
                {state === "done" ? <Icon name="check" size={12} strokeWidth={2.6} /> : <span class="font-mono text-[11px] font-bold">{k + 1}</span>}
              </span>
              <span class="hidden min-w-0 lg:block">
                <span class={`block text-[13.5px] font-semibold ${state === "future" ? "text-muted" : "text-fg"}`}>{s.title}</span>
                <span class="block text-[12px] leading-snug text-faint">{s.blurb}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function FirstWork({
  me,
  intents,
  skills,
  interests,
  hours,
  stretch,
}: {
  me: string;
  intents: Intent[];
  skills: Skill[];
  interests: string[];
  hours: number;
  stretch: number;
}) {
  const asks = openAsks(intents, me);
  const askIds = new Set(asks.map((a) => a.intent.id));
  const live = intents.filter((i) => i.phase !== "done" && i.author !== me && !askIds.has(i.id));
  const skillMatches = live
    .map((i) => {
      const hits = skills.filter((s) => matches(i, s.name));
      return { i, hits, score: hits.reduce((a, s) => a + s.level, 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const taken = new Set(skillMatches.map((x) => x.i.id));
  const stretchMatch =
    stretch > 0
      ? live
          .filter((i) => !taken.has(i.id) && (i.kind === "bug" || i.kind === "feature"))
          .map((i) => ({ i, hit: interests.find((n) => matches(i, n)) }))
          .find((x) => x.hit)
      : undefined;
  const estH = asks.length * 0.5 + skillMatches.length * 1 + (stretchMatch ? 1 : 0);

  return (
    <div class="flex flex-col gap-5">
      <div class="grid grid-cols-3 overflow-hidden rounded-[10px] border border-line">
        <div class="k-stat">
          <strong>{asks.length}</strong>
          <span>waiting on you now</span>
        </div>
        <div class="k-stat">
          <strong>{skillMatches.length + (stretchMatch ? 1 : 0)}</strong>
          <span>you'd be matched to</span>
        </div>
        <div class="k-stat">
          <strong>
            ~{estH.toFixed(estH % 1 ? 1 : 0)}h
          </strong>
          <span>of your {hours}h this week</span>
        </div>
      </div>

      {asks.length ? (
        <section>
          <h3 class="k-heading !text-[14px]">Already waiting on you</h3>
          <ul class="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {asks.map(({ intent, card, assignment, msg }) => (
              <li key={msg.id}>
                <a href={hrefIntent(intent.id, "conversation")} class="k-card k-card--hover flex items-center gap-3 px-3.5 py-2.5 text-fg no-underline">
                  <Icon name={card.type === "question" ? "messageQuestion" : "hand"} size={15} class="flex-none text-amber" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[13.5px] font-semibold">{card.type === "question" ? card.question.prompt : card.gate}</span>
                    <span class="block truncate text-[12px] text-muted">
                      {intent.id} · {assignment.detail}
                    </span>
                  </span>
                  <KindPill kind={intent.kind} compact />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 class="k-heading !text-[14px]">Matched on your skills</h3>
        {skillMatches.length ? (
          <ul class="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {skillMatches.map(({ i, hits }) => (
              <li key={i.id}>
                <a href={hrefIntent(i.id)} class="k-card k-card--hover flex items-center gap-3 px-3.5 py-2.5 text-fg no-underline">
                  <Icon name="target" size={15} class="flex-none text-ink" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[13.5px] font-semibold">{i.title}</span>
                    <span class="block truncate text-[12px] text-muted">
                      {i.id} · {PHASE_LABEL[i.phase]} · matched on {hits.map((h) => h.name).join(", ")}
                    </span>
                  </span>
                  <KindPill kind={i.kind} compact />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p class="mt-2 mb-0 text-[13px] text-muted">Nothing in flight matches your skills yet. Add a few on the first step.</p>
        )}
      </section>

      {stretchMatch ? (
        <section>
          <h3 class="k-heading !text-[14px]">A stretch, because you said you want to grow into {stretchMatch.hit}</h3>
          <a href={hrefIntent(stretchMatch.i.id)} class="k-card k-card--hover mt-2 flex items-center gap-3 px-3.5 py-2.5 text-fg no-underline">
            <Icon name="compass" size={15} class="flex-none text-feat" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[13.5px] font-semibold">{stretchMatch.i.title}</span>
              <span class="block truncate text-[12px] text-muted">
                {stretchMatch.i.id} · low risk · reviewed alongside someone who knows the area
              </span>
            </span>
            <span class="k-pill k-pill--feat">stretch</span>
          </a>
        </section>
      ) : null}
    </div>
  );
}
