/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// Define a new intent in conversation with the definer agent. The left pane is
// the conversation; the right pane is the draft intent filling in as the agent
// works: the outcome rubric, the criticality (set by the agent, never by a
// person), the value in the tenant's one metric, the repositories and
// dependencies it found, and a sizing check that splits anything too big for
// one orchestrator. Importance is the only priority input a person sets.
//
// Scripted: the definer's replies are canned per example request, with a
// generic fallback for free text. Submitting writes the intent (and any split
// follow-up) through createIntent, as the real system would write markdown.

import { useEffect, useRef, useState } from "preact/hooks";
import { AgentAvatar, PersonAvatar } from "../components/Avatar";
import { Icon, type IconName } from "../components/icons";
import { Markdown } from "../components/Markdown";
import { KindPill } from "../components/Pills";
import { person, REPOS, TENANT } from "../data/org";
import { money, PHASE_LABEL, pct } from "../format";
import { compareIntents, hasSlot, wipLimit } from "../priority";
import { hrefIntent, navigate } from "../router";
import { createIntent, now, useMe, useStore, type Draft } from "../store";
import { PHASES, type Criterion, type Importance, type Intent, type Kind, type Message, type QuestionOption } from "../types";

// ───────────────────────────── scenarios ─────────────────────────────

interface Dep {
  id: string;
  why: string;
}

interface Working {
  title?: string;
  request?: string;
  kind?: Kind;
  kindReason?: string;
  value?: Intent["value"];
  repos?: string[];
  dependsOn?: Dep[];
  outcome?: Criterion[];
  sizing?: Intent["sizing"];
  split?: { title: string; request: string; repos: string[]; sizing: Intent["sizing"]; value: number };
}

interface Ask {
  header: string;
  prompt: string;
  trigger: "clarification" | "decision-branch";
  confidence: number;
  options: QuestionOption[];
  /** How the answer changes the draft. */
  apply: (label: string, d: Working) => Working;
  reply: (label: string) => string;
}

interface Scenario {
  example?: string;
  title: string;
  request: string;
  intro: string;
  read: string;
  kind: Kind;
  kindReason: string;
  value: Intent["value"];
  repos: string[];
  dependsOn: Dep[];
  outcome: Criterion[];
  sizing: Intent["sizing"];
  asks: Ask[];
}

const c = (text: string, check: Criterion["check"]): Criterion => ({ text, status: "pending", check });

const PAUSE: Scenario = {
  example: "Let customers pause a subscription for up to 3 months",
  title: "Let customers pause a subscription for up to three months",
  request:
    "Seasonal customers cancel in their quiet months and many never come back. Let an account admin pause a subscription for up to three months instead of cancelling, then resume automatically, with billing, dunning and the ledger all agreeing on what a paused month means.",
  intro:
    "Got it. Pausing touches billing, the ledger, the portal and dunning, so I'll check what's already in flight before I estimate anything.",
  read: "Read ktiro-docs: glossary (subscription states), ADR-0007, billing-engine docs site; scanned 14 in-flight intents",
  kind: "feature",
  kindReason: "New customer capability. It changes when invoices are raised, but through the existing billing path, so it isn't a data-integrity fix.",
  value: {
    amount: 27_000,
    basis: "22% of churned SMB accounts in the cancellation survey cite seasonal usage (£610k ARR lost last year); the retention model recovers about a fifth of them with a pause option.",
    confidence: 0.55,
  },
  repos: ["billing-engine", "ledger-api", "customer-portal", "notifications"],
  dependsOn: [{ id: "0140", why: "0140 is changing when dunning emails are scheduled in notifications; paused subscriptions must be excluded from the new schedule." }],
  outcome: [
    c("An admin can pause a subscription for 1–3 months from the portal, and resume early", "grader"),
    c("No invoice is raised and no dunning email is sent while a subscription is paused", "tests"),
    c("The subscription resumes on the chosen date and bills the right prorated amount", "tests"),
    c("Pause-instead-of-cancel rate for exposed accounts is at least 15% during burn-in", "canary"),
  ],
  sizing: { estTurns: 190, contextFit: 0.64 },
  asks: [
    {
      header: "Billing during pause",
      prompt: "What should a paused month cost the customer?",
      trigger: "decision-branch",
      confidence: 0.48,
      options: [
        { label: "Nothing", description: "No invoice while paused. Simplest to explain and to build; the retention model assumes this.", recommended: true },
        { label: "A small pause fee", description: "Keeps some revenue and data retention costs covered, but needs a new price type and its own invoice line." },
        { label: "Credit on resume", description: "Bill as normal, credit the paused months back on resume. Confusing on the invoice; finance dislikes it." },
      ],
      apply: (label, d) =>
        label === "A small pause fee"
          ? {
              ...d,
              outcome: [...(d.outcome ?? []), c("A paused month raises one invoice line for the pause fee, and nothing else", "tests")],
              sizing: { estTurns: 250, contextFit: 0.79 },
            }
          : label === "Credit on resume"
            ? { ...d, outcome: [...(d.outcome ?? []), c("Credits for paused months net to zero against their invoices", "tests")], sizing: { estTurns: 210, contextFit: 0.7 } }
            : d,
      reply: (label) =>
        label === "Nothing"
          ? "No invoice while paused. I've added that to the outcome as a testable rule."
          : `Going with **${label.toLowerCase()}**. I've added a criterion for it, and re-estimated the size.`,
    },
    {
      header: "Who can pause",
      prompt: "Who should be able to pause a subscription?",
      trigger: "clarification",
      confidence: 0.6,
      options: [
        { label: "Account admins, self-serve", description: "Any admin, from the plan page. Matches how plan changes work today.", recommended: true },
        { label: "Support only", description: "Customers ask, support pauses. No portal work, but no self-serve value either." },
        { label: "Admins, with approval for enterprise", description: "Self-serve for SMB; enterprise pauses go to their account manager first." },
      ],
      apply: (label, d) =>
        label === "Support only"
          ? { ...d, repos: (d.repos ?? []).filter((r) => r !== "customer-portal"), outcome: (d.outcome ?? []).map((x, k) => (k === 0 ? c("Support can pause a subscription for 1–3 months from the admin console", "grader") : x)) }
          : label.startsWith("Admins, with")
            ? { ...d, outcome: [...(d.outcome ?? []), c("Enterprise pause requests wait for account-manager approval before taking effect", "tests")] }
            : d,
      reply: (label) => `Noted: **${label.toLowerCase()}**. The outcome now says exactly who can do it.`,
    },
  ],
};

const DOUBLE: Scenario = {
  example: "Annual customers get charged twice when they add seats mid-year",
  title: "Stop charging annual customers twice when they add seats mid-year",
  request:
    "When an admin on an annual plan adds seats mid-year, the prorated charge is raised once by the seat change and again by the next invoice run. Charge it once, and repair the accounts that were charged twice.",
  intro: "That's money written wrong, which changes how I'll classify it. Let me look at the invoice runs first.",
  read: "Read billing-engine docs site (proration, invoice runs), ADR-0001 append-only ledger; queried 90 days of seat-change invoices",
  kind: "data-integrity",
  kindReason: "Customers are charged twice: the ledger records money that was never owed. Integrity fixes outrank every feature and bug.",
  value: {
    amount: 62_000,
    basis: "37 annual accounts (£1.4M ARR) were double-charged in 90 days; 4 have raised it at renewal. Protected ARR at the observed escalation rate.",
    confidence: 0.6,
  },
  repos: ["billing-engine", "ledger-api"],
  dependsOn: [],
  outcome: [
    c("A mid-year seat change on an annual plan is charged exactly once", "tests"),
    c("Every double charge in the last 12 months is repaired by an auditable entry, never a delete", "grader"),
    c("Invoice-run benchmark stays within 5% of today", "benchmark"),
  ],
  sizing: { estTurns: 120, contextFit: 0.41 },
  asks: [
    {
      header: "Repair",
      prompt: "How should the accounts that were charged twice be made whole?",
      trigger: "decision-branch",
      confidence: 0.52,
      options: [
        { label: "Refund to the original payment method", description: "Customers see the money back within days. Needs the PSP refund path, which payments-gateway already has.", recommended: true },
        { label: "Credit on the next invoice", description: "No PSP calls; slower for the customer and annual customers may wait months." },
        { label: "Fix forward only", description: "Stop new double charges; leave repairs to support. Leaves known wrongs on the ledger." },
      ],
      apply: (label, d) =>
        label.startsWith("Refund")
          ? { ...d, repos: [...(d.repos ?? []), "payments-gateway"], sizing: { estTurns: 140, contextFit: 0.47 } }
          : label.startsWith("Fix")
            ? { ...d, outcome: (d.outcome ?? []).filter((x) => !x.text.startsWith("Every double")) }
            : d,
      reply: (label) =>
        label.startsWith("Refund")
          ? "Refunds it is. That adds **payments-gateway** to the repositories; the repair runs as a dry run first, with its output in the run report."
          : `Going with **${label.toLowerCase()}**. The outcome reflects it.`,
    },
  ],
};

const SSO: Scenario = {
  example: "Admins should be able to require SSO for everyone in their org",
  title: "Let admins require single sign-on for everyone in their organisation",
  request:
    "Enterprise admins can turn on SSO, but members can still sign in with a password. Let an admin require SSO, so password sign-in is refused for everyone in the organisation, with a safe way back in if the identity provider is down.",
  intro: "This closes a password path admins can't shut today, so I'll treat it as a security change and check the auth ADRs.",
  read: "Read ADR-0004 (sessions), customer-portal ADR-0001 (auth flows), ledger-api auth docs; checked 0151 (session expiry) in flight",
  kind: "security",
  kindReason: "Removes an authentication path admins can't disable today. Security outranks everything, whatever the size of the change.",
  value: {
    amount: 75_000,
    basis: "6 enterprise deals in pipeline (£640k ACV) list SSO enforcement as a security-review requirement; 2 renewals cite it.",
    confidence: 0.5,
  },
  repos: ["customer-portal", "ledger-api"],
  dependsOn: [{ id: "0151", why: "0151 revokes sessions on password reset; enforcement must revoke existing password sessions the same way." }],
  outcome: [
    c("With enforcement on, password sign-in is refused for every member of the organisation", "tests"),
    c("Existing password sessions are revoked when enforcement is turned on", "tests"),
    c("Authorisation matrix covers admins, members, and the break-glass path", "tests"),
  ],
  sizing: { estTurns: 110, contextFit: 0.38 },
  asks: [
    {
      header: "Break-glass",
      prompt: "If the identity provider is down, how does anyone get back in?",
      trigger: "decision-branch",
      confidence: 0.44,
      options: [
        { label: "One break-glass admin with a hardware key", description: "A named admin keeps a WebAuthn-only sign-in. Audited, and alerts the org on use.", recommended: true },
        { label: "No exceptions", description: "Strictest. An IdP outage locks the whole org out until it recovers." },
        { label: "Ledgerline support can lift it", description: "Support turns enforcement off on request. Social-engineering risk." },
      ],
      apply: (label, d) =>
        label.startsWith("One break-glass")
          ? { ...d, outcome: [...(d.outcome ?? []), c("Break-glass sign-in needs a hardware key and notifies every admin", "tests")] }
          : d,
      reply: (label) => `Going with **${label.toLowerCase()}**. I've added it to the rubric; the security agent will review it blind.`,
    },
  ],
};

function genericScenario(text: string): Scenario {
  const title = text.trim().replace(/\.$/, "");
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    request: `${title.charAt(0).toUpperCase() + title.slice(1)}.`,
    intro: "Thanks. I'll find where this lives in the product before I estimate anything.",
    read: "Read ktiro-docs: glossary and architecture map; scanned 14 in-flight intents",
    kind: "feature",
    kindReason: "A new capability with no security or ledger exposure that I can see. I'll revisit this if the plan touches money or access.",
    value: { amount: 10_000, basis: "No direct signal in the revenue mart yet; a conservative placeholder until usage data exists.", confidence: 0.3 },
    repos: ["customer-portal"],
    dependsOn: [],
    outcome: [c("The capability is available to the people it's for", "grader"), c("It's covered by tests and documented on the repository's docs site", "tests")],
    sizing: { estTurns: 90, contextFit: 0.32 },
    asks: [
      {
        header: "Who it's for",
        prompt: "Who should be able to do this?",
        trigger: "clarification",
        confidence: 0.4,
        options: [
          { label: "Account admins", description: "The people who manage billing for a customer.", recommended: true },
          { label: "Every user", description: "Anyone signed in to the portal." },
          { label: "Ledgerline staff", description: "Internal only, through the admin console." },
        ],
        apply: (label, d) => ({ ...d, outcome: (d.outcome ?? []).map((x, k) => (k === 0 ? c(`${label} can do it from the portal`, "grader") : x)) }),
        reply: (label) => `Scoped to **${label.toLowerCase()}**. The first outcome criterion now says so.`,
      },
    ],
  };
}

const EXAMPLES = [PAUSE, DOUBLE, SSO];

function pick(text: string): Scenario {
  const t = text.toLowerCase();
  const exact = EXAMPLES.find((s) => s.example?.toLowerCase() === t);
  if (exact) return exact;
  if (/pause/.test(t)) return PAUSE;
  if (/twice|double|charged/.test(t)) return DOUBLE;
  if (/sso|single sign/.test(t)) return SSO;
  return genericScenario(text);
}

// ───────────────────────────── conversation ─────────────────────────────

type Item =
  | { id: string; kind: "me"; body: string }
  | { id: string; kind: "agent"; body: string }
  | { id: string; kind: "event"; icon: IconName; text: string }
  | { id: string; kind: "ask"; index: number; answer?: { label: string; note?: string } };

let itemSeq = 0;
const nid = () => `d${++itemSeq}`;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// The six phases an intent travels, in order. Defining is where this page sits.
const JOURNEY = PHASES.map((p) => PHASE_LABEL[p]);

export function NewIntentView() {
  const me = useMe();
  const intents = useStore((s) => s.intents);
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState<Working>({});
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [thinking, setThinking] = useState(false);
  const [ready, setReady] = useState(false);
  const [importance, setImportance] = useState<Importance>("normal");
  const [text, setText] = useState("");
  const timers = useRef<number[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const draftRef = useRef<Working>(draft);
  draftRef.current = draft;

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [items.length, thinking]);

  const push = (it: Item) => setItems((xs) => [...xs, it]);
  const play = (steps: [number, () => void][]) => {
    let t = 0;
    for (const [delay, fn] of steps) {
      t += delay;
      timers.current.push(window.setTimeout(fn, t));
    }
  };

  const start = (request: string) => {
    const s = pick(request);
    setScenario(s);
    push({ id: nid(), kind: "me", body: request });
    setThinking(true);
    play([
      [1100, () => {
        push({ id: nid(), kind: "agent", body: s.intro });
        setDraft((d) => ({ ...d, title: s.title, request: s.request }));
      }],
      [1300, () => {
        push({ id: nid(), kind: "event", icon: "book", text: s.read });
        setDraft((d) => ({ ...d, repos: s.repos }));
      }],
      [1100, () => {
        setDraft((d) => ({ ...d, kind: s.kind, kindReason: s.kindReason }));
        push({ id: nid(), kind: "agent", body: `I've classified this as **${s.kind.replace("-", " ")}**. ${s.kindReason}` });
      }],
      [1100, () => {
        setDraft((d) => ({ ...d, value: s.value, outcome: s.outcome }));
        push({ id: nid(), kind: "agent", body: `Value against ${TENANT.product}'s one metric: **${money(s.value.amount, { sign: true })} ${TENANT.valueMetric.name}** (confidence ${pct(s.value.confidence)}). ${s.value.basis}` });
      }],
      ...(s.dependsOn.length
        ? ([[1000, () => {
            setDraft((d) => ({ ...d, dependsOn: s.dependsOn }));
            push({ id: nid(), kind: "agent", body: s.dependsOn.map((d) => `It depends on **${d.id}**: ${d.why}`).join("\n\n") });
          }]] as [number, () => void][])
        : []),
      [1000, () => {
        setThinking(false);
        push({ id: nid(), kind: "ask", index: 0 });
      }],
    ]);
  };

  const finish = (s: Scenario) => {
    setThinking(true);
    play([
      [1300, () => {
        const d = draftRef.current;
        const sizing = d.sizing ?? s.sizing;
        if (sizing.contextFit > 0.75) {
          const split = {
            title: "Charge a monthly fee on paused subscriptions",
            request: "Raise a monthly pause-fee invoice line for paused subscriptions, using a new pause-fee price type.",
            repos: ["billing-engine", "invoice-renderer"],
            sizing: { estTurns: 90, contextFit: 0.31 },
            value: Math.round((d.value?.amount ?? 0) * 0.25),
          };
          push({
            id: nid(),
            kind: "agent",
            body: `Context fit is **${pct(sizing.contextFit)}**, too close to one orchestrator's limit. I've split it: this intent keeps pausing and resuming; **the pause fee** becomes a follow-up intent that depends on this one. Both are on the right.`,
          });
          setDraft({ ...d, sizing: { estTurns: 170, contextFit: 0.58 }, split, outcome: (d.outcome ?? []).filter((x) => !x.text.includes("pause fee")) });
        } else {
          push({ id: nid(), kind: "agent", body: `Sizing: about **${sizing.estTurns} agent turns**, context fit **${pct(sizing.contextFit)}**. One orchestrator can own it end to end, so no split needed.` });
          setDraft({ ...d, sizing });
        }
      }],
      [1100, () => {
        setThinking(false);
        setReady(true);
        push({
          id: nid(),
          kind: "agent",
          body: "The draft is ready. Set its **importance** if you want to (it only breaks ties after criticality and value), then submit. Submitting is your acceptance of the intent.",
        });
      }],
    ]);
  };

  const answer = (itemId: string, index: number, label: string, note?: string) => {
    if (!scenario) return;
    const ask = scenario.asks[index];
    setItems((xs) => xs.map((x) => (x.id === itemId && x.kind === "ask" ? { ...x, answer: { label, note } } : x)));
    setThinking(true);
    play([
      [1200, () => {
        setDraft((d) => ask.apply(label, d));
        push({ id: nid(), kind: "agent", body: ask.reply(label) });
        if (index + 1 < scenario.asks.length) {
          setThinking(false);
          push({ id: nid(), kind: "ask", index: index + 1 });
        } else {
          finish(scenario);
        }
      }],
    ]);
  };

  const send = (e?: Event) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    if (!scenario) return start(t);
    push({ id: nid(), kind: "me", body: t });
    setThinking(true);
    play([[1200, () => (setThinking(false), push({ id: nid(), kind: "agent", body: "Noted. I've added that to the request's context; it'll travel with the intent into planning." }))]]);
  };

  // Where would this land?
  const nextId = String(Math.max(...intents.map((i) => Number(i.id))) + 1).padStart(4, "0");
  const slug = slugify(draft.title ?? "new-intent");
  const live = intents.filter((i) => i.phase !== "done");
  const pseudo = { kind: draft.kind ?? "feature", value: draft.value ?? { amount: 0, basis: "", confidence: 0 }, importance, createdAt: now() } as Intent;
  const rank = live.filter((i) => compareIntents(i, pseudo) < 0).length + 1;
  const slot = hasSlot(intents, "defining");

  const submit = () => {
    if (!scenario || !draft.title) return;
    const base = now() - items.length * 15_000;
    const transcript: Message[] = items.map((it, k) => {
      const at = base + k * 15_000;
      const id = `n${nextId}-${k}`;
      if (it.kind === "me") return { id, at, from: { kind: "person", id: me }, phase: "defining", body: it.body };
      if (it.kind === "agent") return { id, at, from: { kind: "agent", id: "definer" }, phase: "defining", body: it.body };
      if (it.kind === "event") return { id, at, from: { kind: "agent", id: "definer" }, phase: "defining", card: { type: "event", icon: "fileText", text: it.text, tone: "neutral" } };
      const a = scenario.asks[it.index];
      return {
        id,
        at,
        from: { kind: "agent", id: "definer" },
        phase: "defining",
        card: {
          type: "question",
          question: { header: a.header, prompt: a.prompt, trigger: a.trigger, confidence: a.confidence, options: a.options },
          assigned: [{ person: me, match: "author", detail: "You wrote this intent" }],
          answer: it.answer ? { label: it.answer.label, note: it.answer.note, by: me } : undefined,
        },
      };
    });
    if (slot) {
      transcript.push({
        id: `n${nextId}-gate`,
        at: now(),
        from: { kind: "agent", id: "orchestrator" },
        phase: "defining",
        card: { type: "gate", gate: "Intent accepted", summary: "Outcome rubric, criticality and value estimate", assigned: [{ person: me, match: "author", detail: "You wrote this intent" }] },
      });
    }
    const d: Draft = {
      title: draft.title,
      request: draft.request ?? "",
      kind: draft.kind ?? "feature",
      kindReason: draft.kindReason ?? "",
      value: draft.value ?? { amount: 0, basis: "", confidence: 0 },
      importance,
      repos: draft.repos ?? [],
      outcome: draft.outcome ?? [],
      dependsOn: (draft.dependsOn ?? []).map((x) => x.id),
      sizing: draft.sizing ?? scenario.sizing,
    };
    const id = createIntent(d, transcript);
    if (draft.split) {
      const sp = draft.split;
      createIntent(
        {
          title: sp.title,
          request: sp.request,
          kind: "feature",
          kindReason: `Split from ${id} so each fits one orchestrator's context window.`,
          value: { amount: sp.value, basis: `A share of ${id}'s estimate, attributed to the fee.`, confidence: 0.4 },
          importance: "normal",
          repos: sp.repos,
          outcome: [c("A paused month raises one invoice line for the pause fee, and nothing else", "tests")],
          dependsOn: [id],
          sizing: sp.sizing,
        },
        [{ id: `n${id}-split`, at: now(), from: { kind: "agent", id: "definer" }, phase: "defining", body: `Split from **${id}** to keep both inside one orchestrator's context window.` }],
      );
    }
    navigate(hrefIntent(id));
  };

  const started = items.length > 0;

  return (
    <div>
      <a href="#/" class="inline-flex items-center gap-1.5 text-[13px] text-muted no-underline hover:text-fg">
        <Icon name="arrowLeft" size={14} /> My work
      </a>
      <div class="mt-3 flex flex-wrap items-end gap-4">
        <div>
          <div class="k-eyebrow">New intent</div>
          <h1 class="mt-1 mb-0 text-[26px] leading-tight font-bold tracking-[-0.01em]">Describe the outcome you want</h1>
          <p class="mt-1.5 mb-0 max-w-[68ch] text-[14.5px] text-muted">
            Say it in plain words. The definer agent turns it into an intent: a gradable outcome, a criticality, a value estimate and a size that one orchestrator can own end to end.
          </p>
        </div>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* ── Conversation ── */}
        <section class="k-card flex min-h-[560px] flex-col overflow-hidden lg:h-[calc(100vh-230px)]" aria-label="Conversation with the definer agent">
          <div class="flex items-center gap-2.5 border-b border-line px-4 py-3">
            <AgentAvatar id="definer" size={26} />
            <div class="leading-tight">
              <div class="text-[13.5px] font-semibold">definer-agent</div>
              <div class="text-[12px] text-muted">Reads the knowledge base and what's in flight; asks when it's unsure</div>
            </div>
          </div>
          <div ref={scroller} class="flex-1 overflow-y-auto px-4 py-3">
            {!started ? (
              <div class="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
                <AgentAvatar id="definer" size={44} />
                <p class="mt-4 mb-0 max-w-[44ch] text-[14.5px]">What should be true for customers that isn't today?</p>
                <p class="mt-1 mb-0 text-[13px] text-muted">Features, bugs and fixes all start here; size never changes the artifact.</p>
                <div class="mt-5 flex max-w-[560px] flex-col gap-2">
                  {EXAMPLES.map((s) => (
                    <button key={s.example} type="button" class="k-option !items-center" onClick={() => start(s.example!)}>
                      <Icon name="sparkles" size={14} class="flex-none text-ink" />
                      <span class="text-[13.5px]">{s.example}</span>
                      <Icon name="arrowRight" size={14} class="ml-auto flex-none text-faint" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              items.map((it) => <ChatItem key={it.id} item={it} me={me} scenario={scenario!} onAnswer={answer} />)
            )}
            {thinking ? (
              <div class="flex items-center gap-3 py-2.5">
                <AgentAvatar id="definer" size={30} />
                <span class="text-[13px] text-muted">definer-agent is working</span>
                <span class="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} class="k-live-dot !size-[5px]" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </span>
              </div>
            ) : null}
          </div>
          <form class="flex items-end gap-2 border-t border-line p-2.5" onSubmit={send}>
            <textarea
              class="min-h-[40px] flex-1 resize-none rounded-lg border border-line-3 bg-surface px-3 py-2 text-[14px] text-fg outline-none placeholder:text-faint focus:border-accent"
              rows={2}
              placeholder={started ? "Add context for the definer…" : "e.g. Let customers pause a subscription for up to 3 months"}
              value={text}
              onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button type="submit" class="k-btn k-btn--primary" disabled={!text.trim() || thinking}>
              <Icon name="send" size={14} /> Send
            </button>
          </form>
        </section>

        {/* ── Draft ── */}
        <aside class="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-110px)] lg:self-start lg:overflow-y-auto [&>*]:flex-none">
          <DraftPreview
            draft={draft}
            importance={importance}
            setImportance={setImportance}
            path={`ktiro-intents/intents/${nextId}-${slug}/intent.md`}
            nextId={nextId}
          />
          <div class="k-card k-card--pad">
            <div class="flex items-center gap-2">
              <Icon name="list" size={15} class="text-ink" />
              <h3 class="k-heading !text-[14px]">Where it lands</h3>
            </div>
            {draft.kind ? (
              <p class="mt-2 mb-0 text-[13px] leading-relaxed text-muted">
                <strong class="text-fg">#{rank}</strong> of {live.length + 1} in pull order (criticality, then value, then importance).{" "}
                {slot ? (
                  <>Defining has a free slot, so it starts as soon as you accept it.</>
                ) : (
                  <>
                    Defining is full ({wipLimit("defining")}/{wipLimit("defining")}), so it queues and is pulled by priority when a slot frees.
                  </>
                )}
              </p>
            ) : (
              <p class="mt-2 mb-0 text-[13px] text-faint">Appears once the definer has classified and valued it.</p>
            )}
            <ol class="m-0 mt-3 flex list-none flex-wrap items-center gap-x-1.5 gap-y-1 p-0 text-[11.5px] text-muted" aria-label="The journey ahead">
              {JOURNEY.map((step, k) => (
                <li key={step} class="flex items-center gap-1.5">
                  <span class={k === 0 ? "font-semibold text-ink" : ""}>{step}</span>
                  {k < JOURNEY.length - 1 ? <Icon name="chevronRight" size={11} class="text-faint" /> : null}
                </li>
              ))}
            </ol>
            <p class="mt-1.5 mb-0 text-[11.5px] leading-relaxed text-faint">
              Done means its flag is at 100% of customers and removed from the code.
            </p>
            <button type="button" class="k-btn k-btn--primary mt-3.5 w-full" disabled={!ready} onClick={submit}>
              <Icon name="check" size={15} /> Submit intent{draft.split ? "s" : ""}
            </button>
            <p class="mt-2 mb-0 text-center text-[11.5px] text-faint">
              Written to ktiro-intents as markdown by ktiro. Nobody pushes; nothing is lost.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ChatItem({ item, me, scenario, onAnswer }: { item: Item; me: string; scenario: Scenario; onAnswer: (id: string, index: number, label: string, note?: string) => void }) {
  if (item.kind === "event") {
    return (
      <div class="flex animate-rise items-start gap-3 py-1.5 pl-[4px]">
        <span class="mt-px grid size-[22px] flex-none place-items-center rounded-full border border-line bg-surface text-muted">
          <Icon name={item.icon} size={12} strokeWidth={2.2} />
        </span>
        <span class="text-[12.5px] text-muted">{item.text}</span>
      </div>
    );
  }
  if (item.kind === "ask") return <LocalAsk item={item} ask={scenario.asks[item.index]} me={me} onAnswer={onAnswer} />;
  const mine = item.kind === "me";
  return (
    <div class="flex animate-rise gap-3 py-2.5">
      {mine ? <PersonAvatar id={me} size={30} /> : <AgentAvatar id="definer" size={30} />}
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-2">
          <strong class="text-[13.5px]">{mine ? person(me).name : "definer-agent"}</strong>
          {!mine ? <span class="font-mono text-[11px] text-faint">agent</span> : null}
        </div>
        <Markdown src={item.body} class="mt-1" />
      </div>
    </div>
  );
}

function LocalAsk({ item, ask, me, onAnswer }: { item: Extract<Item, { kind: "ask" }>; ask: Ask; me: string; onAnswer: (id: string, index: number, label: string, note?: string) => void }) {
  const [sel, setSel] = useState(Math.max(0, ask.options.findIndex((o) => o.recommended)));
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const chosen = sel === ask.options.length ? other.trim() : ask.options[sel].label;
  return (
    <div class="flex animate-rise gap-3 py-2.5">
      <AgentAvatar id="definer" size={30} />
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-2">
          <strong class="text-[13.5px]">definer-agent</strong>
          <span class="font-mono text-[11px] text-faint">agent</span>
        </div>
        {item.answer ? (
          <div class="k-card mt-2 overflow-hidden">
            <div class="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5">
              <span class="k-chip !py-0.5">{ask.header}</span>
              <span class="text-[13.5px] font-semibold">{ask.prompt}</span>
            </div>
            <div class="flex items-center gap-2.5 px-4 py-3 text-[13.5px]">
              <span class="grid size-5 place-items-center rounded-full bg-done text-onaccent">
                <Icon name="check" size={12} strokeWidth={2.6} />
              </span>
              <strong>{item.answer.label}</strong>
              <span class="text-muted">· answered by {person(me).name}</span>
            </div>
            {item.answer.note ? <p class="m-0 border-t border-line px-4 py-2.5 text-[13px] text-muted">"{item.answer.note}"</p> : null}
          </div>
        ) : (
          <div class="k-card mt-2 overflow-hidden border-amber shadow-[0_0_0_3px_color-mix(in_oklab,var(--k-amber)_12%,transparent)]">
            <div class="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5">
              <Icon name="messageQuestion" size={15} class="text-amber" />
              <span class="text-[12.5px] font-semibold text-amber">{ask.trigger === "decision-branch" ? "Stopped at a decision branch" : "Needs a clarification"}</span>
              <span class="font-mono text-[11.5px] text-faint">confidence {ask.confidence.toFixed(2)}</span>
            </div>
            <div class="p-4">
              <div class="flex flex-wrap items-center gap-2">
                <span class="k-chip !py-0.5">{ask.header}</span>
                <h4 class="m-0 text-[15px] font-bold">{ask.prompt}</h4>
              </div>
              <div class="mt-3 flex flex-col gap-2" role="radiogroup" aria-label={ask.prompt}>
                {ask.options.map((o, i) => (
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
                <div class={`k-option !cursor-default ${sel === ask.options.length ? "is-selected" : ""}`} onClick={() => setSel(ask.options.length)}>
                  <span class="k-option__radio font-mono text-[10.5px]">{sel === ask.options.length ? <Icon name="check" size={11} strokeWidth={3} /> : ask.options.length + 1}</span>
                  <input
                    class="w-full border-0 bg-transparent p-0 text-[13.5px] text-fg outline-none placeholder:text-faint"
                    placeholder="Other: say what you'd prefer…"
                    value={other}
                    onFocus={() => setSel(ask.options.length)}
                    onInput={(e) => setOther((e.target as HTMLInputElement).value)}
                  />
                </div>
              </div>
              <input
                class="k-input mt-3 text-[13px]"
                placeholder="Note for the agent (optional)"
                value={note}
                onInput={(e) => setNote((e.target as HTMLInputElement).value)}
              />
              <button type="button" class="k-btn k-btn--primary mt-3" disabled={!chosen} onClick={() => chosen && onAnswer(item.id, item.index, chosen, note.trim() || undefined)}>
                <Icon name="send" size={14} /> Answer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── draft preview ─────────────────────────────

const CHECK_ICON: Record<Criterion["check"], IconName> = { grader: "target", tests: "check", canary: "flag", benchmark: "gauge", human: "user" };

function Skel({ w = "100%", h = 12 }: { w?: string; h?: number }) {
  return <span class="k-skeleton block" style={{ width: w, height: `${h}px` }} />;
}

function Field({ label, icon, children }: { label: string; icon: IconName; children: preact.ComponentChildren }) {
  return (
    <div class="border-t border-line px-4 py-3.5">
      <div class="mb-1.5 flex items-center gap-1.5 k-label">
        <Icon name={icon} size={13} /> {label}
      </div>
      {children}
    </div>
  );
}

function DraftPreview({
  draft,
  importance,
  setImportance,
  path,
  nextId,
}: {
  draft: Working;
  importance: Importance;
  setImportance: (i: Importance) => void;
  path: string;
  nextId: string;
}) {
  const fit = draft.sizing?.contextFit;
  return (
    <section class="k-card overflow-hidden" aria-label="Draft intent">
      <div class="flex items-center gap-2 px-4 py-3">
        <Icon name="fileText" size={15} class="text-ink" />
        <h2 class="k-heading !text-[14px]">Draft intent</h2>
        <span class="k-mono-tag ml-auto !text-[11px]">{nextId}</span>
      </div>
      <div class="border-t border-line px-4 py-3.5">
        {draft.title ? <div class="animate-rise text-[16px] leading-snug font-bold">{draft.title}</div> : <Skel w="80%" h={16} />}
        <div class="mt-2">
          {draft.request ? (
            <p class="m-0 animate-rise text-[13px] leading-relaxed text-muted">{draft.request}</p>
          ) : (
            <div class="flex flex-col gap-1.5">
              <Skel />
              <Skel w="70%" />
            </div>
          )}
        </div>
      </div>
      <Field label="Outcome · how we'll know it's done" icon="target">
        {draft.outcome ? (
          <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
            {draft.outcome.map((o) => (
              <li key={o.text} class="flex animate-rise items-start gap-2 text-[13px] leading-snug">
                <span class="mt-0.5 grid size-4 flex-none place-items-center rounded-full border border-dashed border-line-3" />
                <span class="min-w-0 flex-1">{o.text}</span>
                <span class="k-pill k-pill--neutral !py-0 !text-[10.5px]">
                  <Icon name={CHECK_ICON[o.check]} size={10} /> {o.check}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div class="flex flex-col gap-1.5">
            <Skel />
            <Skel w="85%" />
            <Skel w="60%" />
          </div>
        )}
      </Field>
      <div class="grid grid-cols-2">
        <Field label="Criticality" icon="shield">
          {draft.kind ? (
            <div class="animate-rise">
              <KindPill kind={draft.kind} />
              <p class="mt-1.5 mb-0 text-[11.5px] leading-snug text-faint">Set by the agent. You can dispute it, not set it.</p>
            </div>
          ) : (
            <Skel w="60%" h={18} />
          )}
        </Field>
        <div class="border-l border-line">
          <Field label={`Value · ${TENANT.valueMetric.name}`} icon="trendingUp">
            {draft.value ? (
              <div class="animate-rise">
                <div class="font-mono text-[18px] font-bold">{money(draft.value.amount, { sign: true })}</div>
                <div class="mt-1 flex items-center gap-1.5 text-[11.5px] text-faint">
                  <span class="k-track w-14">
                    <span style={{ width: pct(draft.value.confidence) }} />
                  </span>
                  {pct(draft.value.confidence)} confident
                </div>
              </div>
            ) : (
              <Skel w="50%" h={18} />
            )}
          </Field>
        </div>
      </div>
      {draft.kindReason ? (
        <p class="m-0 border-t border-line px-4 py-2.5 text-[12.5px] leading-relaxed text-muted">{draft.kindReason}</p>
      ) : null}
      <Field label="Importance · the only priority input you set" icon="sliders">
        <div class="k-seg" role="radiogroup" aria-label="Importance">
          {(["low", "normal", "high"] as Importance[]).map((x) => (
            <button key={x} type="button" role="radio" aria-checked={importance === x} class={importance === x ? "is-active" : ""} onClick={() => setImportance(x)}>
              {x}
            </button>
          ))}
        </div>
        <p class="mt-1.5 mb-0 text-[11.5px] text-faint">Breaks ties only, after criticality and value.</p>
      </Field>
      <Field label="Repositories found" icon="folder">
        {draft.repos ? (
          <div class="flex flex-wrap gap-1.5">
            {draft.repos.map((r) => (
              <span key={r} class="k-mono-tag animate-rise !text-[11.5px]">
                {r}
                {REPOS.find((x) => x.name === r)?.customerFacing ? <span class="text-feat"> ·cf</span> : null}
              </span>
            ))}
          </div>
        ) : (
          <Skel w="70%" />
        )}
      </Field>
      {draft.dependsOn?.length ? (
        <Field label="Depends on" icon="link">
          {draft.dependsOn.map((d) => (
            <a key={d.id} href={hrefIntent(d.id)} class="flex animate-rise items-start gap-2 text-[12.5px] text-fg no-underline hover:text-ink">
              <span class="k-mono-tag !text-[11px]">{d.id}</span>
              <span class="text-muted">{d.why}</span>
            </a>
          ))}
        </Field>
      ) : null}
      <Field label="Size · one orchestrator, one context window" icon="cpu">
        {draft.sizing && fit !== undefined ? (
          <div class="animate-rise">
            <div class="flex items-baseline justify-between text-[13px]">
              <span>
                <strong class="font-mono">{draft.sizing.estTurns}</strong> est. turns
              </span>
              <span class="font-mono text-muted">fit {pct(fit)}</span>
            </div>
            <span class="k-track mt-1.5">
              <span style={{ width: pct(Math.min(1, fit)), background: fit > 0.75 ? "var(--k-amber)" : undefined }} />
            </span>
          </div>
        ) : (
          <Skel w="65%" />
        )}
      </Field>
      {draft.split ? (
        <div class="border-t border-line px-4 py-3.5">
          <div class="k-note k-note--accent !text-[12.5px]">
            <Icon name="gitBranch" size={14} class="mt-0.5 flex-none" />
            <span class="text-fg">
              <strong>Split follow-up:</strong> {draft.split.title} · depends on {nextId} · fit {pct(draft.split.sizing.contextFit)}
            </span>
          </div>
        </div>
      ) : null}
      <div class="border-t border-line bg-surface-2 px-4 py-2.5 font-mono text-[11.5px] text-muted" title="Where ktiro will record it">
        <Icon name="gitCommit" size={12} class="mr-1 inline align-[-2px]" />
        {path}
      </div>
    </section>
  );
}
