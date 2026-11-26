/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// Tenant onboarding: the one-time wiring that turns a product into a ktiro
// tenant. The product and its single value metric; the forge (a data store,
// with ktiro as its only writer); the factory repositories and the normalised
// toolchain; the cluster (Kubernetes, Flux, Flagger, OpenFeature); the policy
// (WIP limits, the merge lane, the bug reserve, where people come in, and when
// gates may be skipped); and the people. Ledgerline is already set up, so this
// replays it with its values.

import { useEffect, useRef, useState } from "preact/hooks";
import { PersonAvatar } from "../components/Avatar";
import { Icon, type IconName } from "../components/icons";
import { AGENTS, FACTORY_REPOS, PEOPLE, REPOS, TENANT } from "../data/org";
import { PHASE_LABEL } from "../format";
import { PHASES, type ImpactRisk, type Phase } from "../types";
import { Stepper } from "./Welcome";

const STEPS: { title: string; icon: IconName; blurb: string }[] = [
  { title: "Product", icon: "box", blurb: "What you're building, and the one number that says it's working." },
  { title: "Forge", icon: "gitBranch", blurb: "Where ktiro keeps everything. People never push." },
  { title: "Repositories", icon: "folder", blurb: "The factory's repositories and a normalised toolchain." },
  { title: "Cluster", icon: "cpu", blurb: "Kubernetes, Flux, Flagger and feature flags." },
  { title: "Policy", icon: "sliders", blurb: "How much is in flight, and when people decide." },
  { title: "People", icon: "users", blurb: "Invite your team. They describe themselves next." },
];

const LATEST_TOOLCHAIN = "v4.2.0";

export function SetupView() {
  const [step, setStep] = useState(0);
  const [provisioning, setProvisioning] = useState<"idle" | "running" | "done">("idle");

  return (
    <div>
      <div class="flex flex-wrap items-end gap-4">
        <div>
          <div class="k-eyebrow">Tenant setup</div>
          <h1 class="mt-1 mb-0 text-[26px] leading-tight font-bold tracking-[-0.01em]">Set up {TENANT.product} on ktiro</h1>
          <p class="mt-1.5 mb-0 max-w-[70ch] text-[14.5px] text-muted">
            Six steps, once per product. After this, everyone lives in ktiro: intents, plans, decisions and reviews are markdown in git, and the forge stays out of the way.
          </p>
        </div>
      </div>
      <div class="k-note k-note--accent mt-5">
        <Icon name="rotateCcw" size={15} class="mt-0.5 flex-none" />
        <span class="text-fg">{TENANT.product} is already set up. This replays its onboarding with its real values; nothing you change here is saved.</span>
      </div>

      <div class="mt-7 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Stepper step={step} setStep={(n) => provisioning === "idle" && setStep(n)} steps={STEPS} />
        <div class="min-w-0">
          {provisioning !== "idle" ? (
            <Provision onDone={() => setProvisioning("done")} done={provisioning === "done"} />
          ) : (
            <div class="k-card p-5 sm:p-6">
              <div class="flex items-center gap-2">
                <Icon name={STEPS[step].icon} size={18} class="text-ink" />
                <h2 class="k-heading !text-[17px]">{STEPS[step].title}</h2>
              </div>
              <p class="mt-1 mb-5 text-[13.5px] text-muted">{STEPS[step].blurb}</p>
              {step === 0 ? <ProductStep /> : null}
              {step === 1 ? <ForgeStep /> : null}
              {step === 2 ? <ReposStep /> : null}
              {step === 3 ? <ClusterStep /> : null}
              {step === 4 ? <PolicyStep /> : null}
              {step === 5 ? <PeopleStep /> : null}
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
                  <button type="button" class="k-btn k-btn--primary" onClick={() => setProvisioning("running")}>
                    <Icon name="rocket" size={14} /> Provision {TENANT.product}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── steps ─────────────────────────────

function Check({ ok, children }: { ok: boolean; children: preact.ComponentChildren }) {
  return (
    <li class="flex items-center gap-2 text-[13px]">
      <Icon name={ok ? "check" : "alertTriangle"} size={14} strokeWidth={2.4} class={ok ? "text-done" : "text-amber"} />
      <span class={ok ? "" : "text-amber"}>{children}</span>
    </li>
  );
}

function ProductStep() {
  const m = TENANT.valueMetric;
  const [name, setName] = useState(TENANT.product);
  const [metric, setMetric] = useState(m.name);
  const [unit, setUnit] = useState(m.unit);
  const [definition, setDefinition] = useState(m.definition);
  const [source, setSource] = useState(m.source);
  const subjective = /\b(satisf|happ|feel|sentiment|nps|delight)/i.test(`${metric} ${definition}`);
  return (
    <div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
      <div class="flex flex-col gap-4">
        <label class="block">
          <span class="k-label">Product name</span>
          <input class="k-input mt-1.5" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        </label>
        <div class="rounded-[10px] border border-line bg-surface-2 p-4">
          <div class="flex items-center gap-2">
            <Icon name="trendingUp" size={15} class="text-ink" />
            <strong class="text-[14px]">The value metric</strong>
            <span class="k-pill k-pill--accent !py-0 !text-[11px]">exactly one</span>
          </div>
          <div class="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <label class="block">
              <span class="k-label">Name</span>
              <input class="k-input mt-1.5" value={metric} onInput={(e) => setMetric((e.target as HTMLInputElement).value)} />
            </label>
            <label class="block">
              <span class="k-label">Unit</span>
              <input class="k-input mt-1.5 font-mono" value={unit} onInput={(e) => setUnit((e.target as HTMLInputElement).value)} />
            </label>
          </div>
          <label class="mt-3 block">
            <span class="k-label">Definition</span>
            <textarea class="k-input mt-1.5 min-h-[84px] text-[13.5px]" value={definition} onInput={(e) => setDefinition((e.target as HTMLTextAreaElement).value)} />
          </label>
          <label class="mt-3 block">
            <span class="k-label">Where it's measured (a query ktiro can run)</span>
            <input class="k-input mt-1.5 font-mono text-[13px]" value={source} onInput={(e) => setSource((e.target as HTMLInputElement).value)} />
          </label>
        </div>
      </div>
      <aside class="flex flex-col gap-3">
        <div class="k-card k-card--pad">
          <h3 class="k-heading !text-[14px]">Why only one?</h3>
          <p class="mt-2 mb-0 text-[13px] leading-relaxed text-muted">
            Every intent is valued in the same unit, so priorities compare like for like. Two metrics means someone has to decide how they trade off, and that becomes opinion.
          </p>
        </div>
        <div class="k-card k-card--pad">
          <h3 class="k-heading !text-[14px]">Checks</h3>
          <ul class="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
            <Check ok={!!unit.trim()}>Has a single unit</Check>
            <Check ok={!!source.trim()}>Measurable by a query</Check>
            <Check ok={!subjective}>{subjective ? "Reads as subjective" : "Not subjective"}</Check>
            <Check ok={definition.trim().length > 40}>Defined well enough to grade</Check>
          </ul>
        </div>
      </aside>
    </div>
  );
}

const FORGES: { id: string; title: string; detail: string; icon: IconName }[] = [
  { id: "github", title: "Connect a GitHub organisation", detail: "Install the ktiro GitHub App on an existing org.", icon: "gitBranch" },
  { id: "github-new", title: "Create a new GitHub organisation", detail: "A clean org that holds only ktiro-managed repositories.", icon: "plus" },
  { id: "gitlab", title: "GitLab group", detail: "Self-managed or gitlab.com, via a group access token.", icon: "gitMerge" },
  { id: "forgejo", title: "Forgejo", detail: "Self-hosted, via an OAuth application.", icon: "box" },
];

function ForgeStep() {
  const [forge, setForge] = useState("github");
  const [org, setOrg] = useState(TENANT.forge.org);
  return (
    <div class="flex flex-col gap-5">
      <div class="grid gap-2.5 sm:grid-cols-2">
        {FORGES.map((f) => (
          <button key={f.id} type="button" class={`k-option ${forge === f.id ? "is-selected" : ""}`} onClick={() => setForge(f.id)} aria-pressed={forge === f.id}>
            <span class="k-option__radio">{forge === f.id ? <Icon name="check" size={11} strokeWidth={3} /> : null}</span>
            <span class="min-w-0">
              <span class="flex items-center gap-1.5 text-[13.5px] font-semibold">
                <Icon name={f.icon} size={14} class="text-muted" /> {f.title}
              </span>
              <span class="mt-0.5 block text-[12.5px] text-muted">{f.detail}</span>
            </span>
          </button>
        ))}
      </div>
      <label class="block max-w-[420px]">
        <span class="k-label">{forge.startsWith("github") ? "Organisation" : "Group"}</span>
        <input class="k-input mt-1.5 font-mono" value={org} onInput={(e) => setOrg((e.target as HTMLInputElement).value)} />
      </label>
      <div class="grid gap-3 md:grid-cols-2">
        <div class="k-card k-card--pad">
          <h3 class="k-heading !text-[14px]">What ktiro may do</h3>
          <ul class="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0 text-[13px]">
            {["Create repositories in the org", "Push branches and open pull requests", "Merge, only as a whole merge set", "Set branch protection on every repository"].map((x) => (
              <Check key={x} ok>
                {x}
              </Check>
            ))}
          </ul>
        </div>
        <div class="k-card k-card--pad">
          <h3 class="k-heading !text-[14px]">What people may do</h3>
          <ul class="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0 text-[13px]">
            <Check ok>Read everything</Check>
            <li class="flex items-center gap-2">
              <Icon name="lock" size={14} class="text-muted" /> Push or merge: never
            </li>
            <li class="flex items-center gap-2">
              <Icon name="lock" size={14} class="text-muted" /> Edit intents in the forge: never
            </li>
          </ul>
        </div>
      </div>
      <div class="k-note k-note--accent">
        <Icon name="database" size={15} class="mt-0.5 flex-none" />
        <span class="text-fg">
          The forge is a data store. Branch protection requires the {TENANT.forge.app} app for every merge, so ktiro is the only writer, and nobody needs to open the forge to do their job.
        </span>
      </div>
    </div>
  );
}

function ReposStep() {
  const [factory, setFactory] = useState<Record<string, boolean>>(Object.fromEntries(FACTORY_REPOS.map((r) => [r.name, true])));
  const outdated = REPOS.filter((r) => r.toolchain !== LATEST_TOOLCHAIN);
  return (
    <div class="flex flex-col gap-5">
      <section>
        <h3 class="k-heading !text-[14px]">The factory</h3>
        <p class="mt-1 mb-2.5 text-[13px] text-muted">Created from templates in your org. Every agent's tools live here, so the process agent can improve them.</p>
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          {FACTORY_REPOS.map((r) => {
            const created = r.name.startsWith("ktiro-");
            return (
              <li key={r.name} class="flex items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-2.5">
                <input type="checkbox" class="size-4 flex-none accent-accent" checked={factory[r.name]} onChange={() => setFactory({ ...factory, [r.name]: !factory[r.name] })} aria-label={r.name} />
                <span class="min-w-0 flex-1">
                  <span class="block font-mono text-[13px] font-semibold">{r.name}</span>
                  <span class="block text-[12.5px] text-muted">{r.purpose}</span>
                </span>
                <span class={`k-pill ${created ? "k-pill--accent" : "k-pill--neutral"}`}>{created ? "create" : "adopt shared"}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <section class="k-card overflow-hidden">
        <div class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h3 class="k-heading !text-[14px]">Product repositories</h3>
          <span class="text-[12.5px] text-muted">
            Every repository runs the same way: toolchain {LATEST_TOOLCHAIN} as .mise/, the reusable workflows, a docs site
          </span>
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
                <th class="num">State</th>
              </tr>
            </thead>
            <tbody>
              {REPOS.map((r) => {
                const ok = r.toolchain === LATEST_TOOLCHAIN;
                return (
                  <tr key={r.name}>
                    <td class="font-mono text-[13px]">{r.name}</td>
                    <td class="text-muted">{r.archetype}</td>
                    <td class={`font-mono text-[12.5px] ${ok ? "" : "text-amber"}`}>{r.toolchain}</td>
                    <td class="font-mono text-[12.5px]">{r.workflows}</td>
                    <td class="text-[12.5px] text-muted">{r.docsSite.replace("docs.ledgerline.dev/", "/")}</td>
                    <td class="num">
                      <span class={`k-pill ${ok ? "k-pill--done" : "k-pill--amber"}`}>{ok ? "normalised" : "needs bump"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {outdated.length ? (
        <div class="k-note">
          <Icon name="alertTriangle" size={15} class="mt-0.5 flex-none" />
          <span class="text-fg">
            {outdated.map((r) => r.name).join(", ")} {outdated.length === 1 ? "is" : "are"} behind the toolchain. ktiro will raise an intent to bring {outdated.length === 1 ? "it" : "them"} in line; nobody does it by hand.
          </span>
        </div>
      ) : null}
    </div>
  );
}

type CheckState = "pass" | "missing" | "installing";

function ClusterStep() {
  const cl = TENANT.cluster;
  const [checks, setChecks] = useState<{ name: string; detail: string; state: CheckState; fix?: string }[]>([
    { name: "Kubernetes API", detail: `${cl.name} · ${cl.distro}`, state: "pass" },
    { name: "Flux", detail: `${cl.flux} · reconciling the platform repository`, state: "pass" },
    { name: "Flagger", detail: `${cl.flagger} · canary analysis for every workload`, state: "missing", fix: "Install through the platform repository" },
    { name: "OpenFeature (flagd)", detail: `${cl.openfeature} · reviewers-only targeting for business review, then exposure ramps against a control group`, state: "missing", fix: "Install through the platform repository" },
    { name: "kagent runtime", detail: `Runs the ${AGENTS.length} declarative agents from ktiro-agents`, state: "pass" },
    { name: "Egress broker", detail: "Agent pods hold no credentials; all model traffic goes through it", state: "pass" },
  ]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const install = (k: number) => {
    setChecks((cs) => cs.map((c, j) => (j === k ? { ...c, state: "installing" } : c)));
    timers.current.push(window.setTimeout(() => setChecks((cs) => cs.map((c, j) => (j === k ? { ...c, state: "pass" } : c))), 1800));
  };
  return (
    <div class="flex flex-col gap-4">
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        {checks.map((c, k) => (
          <li key={c.name} class="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-3">
            <span
              class={`grid size-6 flex-none place-items-center rounded-full ${c.state === "pass" ? "bg-done text-onaccent" : c.state === "installing" ? "border border-accent text-ink" : "border border-amber text-amber"}`}
            >
              {c.state === "pass" ? <Icon name="check" size={13} strokeWidth={2.6} /> : c.state === "installing" ? <span class="k-live-dot" /> : <Icon name="alertTriangle" size={12} />}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13.5px] font-semibold">{c.name}</span>
              <span class="block text-[12.5px] text-muted">{c.detail}</span>
            </span>
            {c.state === "missing" ? (
              <button type="button" class="k-btn k-btn--sm" onClick={() => install(k)}>
                <Icon name="wand" size={13} /> {c.fix}
              </button>
            ) : c.state === "installing" ? (
              <span class="font-mono text-[12px] text-ink">opening intent in platform…</span>
            ) : (
              <span class="k-pill k-pill--done">ready</span>
            )}
          </li>
        ))}
      </ul>
      <div class="k-note k-note--accent">
        <Icon name="rocket" size={15} class="mt-0.5 flex-none" />
        <span class="text-fg">
          The target is always Kubernetes with Flux and Flagger. When a merge set lands, Flagger keeps the deploy safe while it goes out dark. The flag then shows it to reviewers only for business review, and after acceptance ramps it against a control group. Both are needed before Operate can confirm an outcome.
        </span>
      </div>
    </div>
  );
}

const IMPACTS: ImpactRisk[] = ["minimal", "low", "moderate", "high"];

/** How each phase involves people, as the policy records it. */
const HIL_POLICY: { phase: Phase; icon: IconName; text: string; always?: boolean }[] = [
  { phase: "defining", icon: "sparkles", text: "The definer agent asks when the request is ambiguous; the author accepts the intent and its outcome rubric." },
  {
    phase: "planning",
    icon: "layers",
    text: "A person approves plans the agent isn't confident in. Planning is the only place an existing ADR may be recommended for change, against a high burden of proof: alternatives weighed, every consumer found, a migration path, and the owner's agreement.",
  },
  { phase: "engineering", icon: "terminal", text: "Agents stop at a decision branch or below the confidence floor, and ask a person matched on skills and interests." },
  {
    phase: "technical",
    icon: "shieldCheck",
    text: "Agents only: code review, the outcome grader and security review run blind to each other. A person comes in only when an agent hits a wall, and always to agree a net-new ADR.",
    always: true,
  },
  {
    phase: "business",
    icon: "eye",
    text: "The merge set is merged and deployed dark. People see the result live behind a reviewers-only flag, with recorded screenshots and video, and acceptance starts the first rollout to customers. A no-op fast path, such as removing a flag, skips it.",
    always: true,
  },
  { phase: "operate", icon: "flag", text: "The flag ramps against a control group through its burn-in. A breached threshold pauses the ramp and asks a person." },
];

function PolicyStep() {
  const [wip, setWip] = useState<Record<string, number>>({ ...TENANT.wip });
  const [bug, setBug] = useState(Math.round(TENANT.bugReserve * 100));
  const [minP, setMinP] = useState(TENANT.autoSkip.minPSuccess);
  const [maxImpact, setMaxImpact] = useState<ImpactRisk>(TENANT.autoSkip.maxImpact as ImpactRisk);
  const [always, setAlways] = useState<string[]>(TENANT.autoSkip.alwaysHumanFor);
  const [newRule, setNewRule] = useState("");
  return (
    <div class="flex flex-col gap-6">
      <section>
        <h3 class="k-heading !text-[14px]">Work in flight, per phase</h3>
        <p class="mt-1 mb-3 text-[13px] text-muted">A strict bound. When a phase is full, work queues and is pulled by priority when a slot frees.</p>
        <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
          {PHASES.map((ph) => (
            <label key={ph} class="block rounded-lg border border-line bg-surface p-3">
              <span class="block text-[12.5px] font-semibold">{PHASE_LABEL[ph]}</span>
              <div class="mt-2 flex items-center gap-2">
                <button type="button" class="k-btn k-btn--sm !px-2" aria-label={`Fewer in ${ph}`} onClick={() => setWip({ ...wip, [ph]: Math.max(1, wip[ph] - 1) })}>
                  −
                </button>
                <span class="w-6 text-center font-mono text-[18px] font-bold">{wip[ph]}</span>
                <button type="button" class="k-btn k-btn--sm !px-2" aria-label={`More in ${ph}`} onClick={() => setWip({ ...wip, [ph]: Math.min(12, wip[ph] + 1) })}>
                  +
                </button>
              </div>
            </label>
          ))}
          <div class="rounded-lg border border-dashed border-line-2 bg-surface-2 p-3">
            <span class="flex items-center gap-1.5 text-[12.5px] font-semibold">
              <Icon name="lock" size={12} /> Merge lane
            </span>
            <div class="mt-2 font-mono text-[18px] font-bold">1</div>
            <span class="text-[11.5px] text-faint">one intent merges at a time</span>
          </div>
        </div>
      </section>
      <section>
        <h3 class="k-heading !text-[14px]">Priority</h3>
        <p class="mt-1 mb-3 text-[13px] text-muted">
          Criticality (security, then data integrity, then features, then bugs; set by agents), then value, then human importance.
        </p>
        <span class="k-label">Bug reserve: share of slots kept for bugs, so they're never starved</span>
        <div class="mt-2 flex max-w-[480px] items-center gap-3">
          <input type="range" min={0} max={50} step={5} value={bug} class="flex-1 accent-accent" onInput={(e) => setBug(Number((e.target as HTMLInputElement).value))} />
          <span class="w-12 text-right font-mono text-[15px] font-bold">{bug}%</span>
        </div>
      </section>
      <section>
        <h3 class="k-heading !text-[14px]">Where people come in</h3>
        <p class="mt-1 mb-3 text-[13px] text-muted">Each phase meets people in its own way. Agents ask; people decide.</p>
        <ol class="m-0 flex list-none flex-col gap-2 p-0">
          {HIL_POLICY.map((r) => (
            <li key={r.phase} class="flex items-start gap-3 rounded-lg border border-line bg-surface px-3.5 py-3">
              <span class="mt-0.5 grid size-7 flex-none place-items-center rounded-full bg-surface-2 text-ink">
                <Icon name={r.icon} size={14} />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-[13.5px] font-semibold">{PHASE_LABEL[r.phase]}</span>
                <span class="mt-0.5 block text-[12.5px] leading-relaxed text-muted">{r.text}</span>
              </span>
              {r.always ? <span class="k-pill k-pill--amber flex-none">always a person</span> : null}
            </li>
          ))}
        </ol>
        <p class="mt-2.5 mb-0 text-[12.5px] text-muted">
          <strong class="text-fg">Done</strong> means the flag is at 100% of customers and removed from the code. Removing it is a fast-path intent: no functional change, so it skips business review.
        </p>
      </section>
      <section>
        <h3 class="k-heading !text-[14px]">When an agent may skip a gate</h3>
        <p class="mt-1 mb-3 text-[13px] text-muted">Between phases there's a gate with a person at it, unless the agent is confident and the change can't do much harm.</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <span class="k-label">Minimum p(success)</span>
            <div class="mt-2 flex items-center gap-3">
              <input type="range" min={0.7} max={0.99} step={0.01} value={minP} class="flex-1 accent-accent" onInput={(e) => setMinP(Number((e.target as HTMLInputElement).value))} />
              <span class="w-12 text-right font-mono text-[15px] font-bold">{minP.toFixed(2)}</span>
            </div>
          </div>
          <div>
            <span class="k-label">Maximum impact if wrong</span>
            <div class="k-seg mt-2">
              {IMPACTS.map((x) => (
                <button key={x} type="button" class={maxImpact === x ? "is-active" : ""} onClick={() => setMaxImpact(x)}>
                  {x}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div class="mt-4">
          <span class="k-label">Always a person, whatever the confidence</span>
          <div class="mt-2 flex flex-wrap gap-1.5">
            {always.map((a) => (
              <span key={a} class="k-chip !text-fg">
                <Icon name="hand" size={12} class="text-amber" /> {a}
                <button type="button" class="cursor-pointer border-0 bg-transparent p-0 text-faint hover:text-fg" aria-label={`Remove ${a}`} onClick={() => setAlways(always.filter((x) => x !== a))}>
                  <Icon name="x" size={11} />
                </button>
              </span>
            ))}
          </div>
          <form
            class="mt-2 flex max-w-[480px] gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newRule.trim()) setAlways([...always, newRule.trim()]);
              setNewRule("");
            }}
          >
            <input class="k-input" placeholder="e.g. database schema changes" value={newRule} onInput={(e) => setNewRule((e.target as HTMLInputElement).value)} />
            <button type="submit" class="k-btn" disabled={!newRule.trim()}>
              <Icon name="plus" size={14} /> Add
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function PeopleStep() {
  const [invited, setInvited] = useState<string[]>(PEOPLE.map((p) => p.id));
  const [extra, setExtra] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  return (
    <div class="flex flex-col gap-4">
      <ul class="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        {PEOPLE.map((p) => {
          const on = invited.includes(p.id);
          return (
            <li key={p.id}>
              <label class={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 ${on ? "border-accent bg-[color-mix(in_oklab,var(--k-accent)_6%,var(--k-surface))]" : "border-line bg-surface"}`}>
                <input type="checkbox" class="size-4 accent-accent" checked={on} onChange={() => setInvited(on ? invited.filter((x) => x !== p.id) : [...invited, p.id])} />
                <PersonAvatar id={p.id} size={28} />
                <span class="min-w-0">
                  <span class="block text-[13.5px] font-semibold">{p.name}</span>
                  <span class="block text-[12px] text-muted">{p.role}</span>
                </span>
              </label>
            </li>
          );
        })}
        {extra.map((x) => (
          <li key={x} class="flex items-center gap-3 rounded-lg border border-accent bg-surface px-3.5 py-2.5">
            <Icon name="send" size={14} class="text-ink" />
            <span class="min-w-0 flex-1 truncate font-mono text-[12.5px]">{x}</span>
            <span class="k-pill k-pill--neutral">invite pending</span>
          </li>
        ))}
      </ul>
      <form
        class="flex max-w-[480px] gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) setExtra([...extra, email.trim()]);
          setEmail("");
        }}
      >
        <input class="k-input" type="email" placeholder="name@example.com" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
        <button type="submit" class="k-btn" disabled={!email.trim()}>
          <Icon name="plus" size={14} /> Invite
        </button>
      </form>
      <div class="k-note k-note--accent">
        <Icon name="user" size={15} class="mt-0.5 flex-none" />
        <span class="text-fg">
          Everyone invited goes through personal onboarding: skills, interests and availability. That's how ktiro decides who to ask, including some stretch work outside their expertise.{" "}
          <a href="#/welcome">See it</a>
        </span>
      </div>
    </div>
  );
}

// ───────────────────────────── provisioning ─────────────────────────────

const LOG: { text: string; icon: IconName }[] = [
  { text: `Verified ${TENANT.forge.app} on ${TENANT.forge.org}: create, push, merge, protect`, icon: "shieldCheck" },
  { text: "Created ktiro-intents from template · intents/, plans, hil/, runs/", icon: "folder" },
  { text: `Created ktiro-agents · ${AGENTS.length} kagent declarative agents and their skills`, icon: "bot" },
  { text: "Created ktiro-docs · knowledge base seeded from 8 repository docs sites and 37 ADRs", icon: "book" },
  { text: `Pinned toolchain ${LATEST_TOOLCHAIN} and github-workflows v8.4.0 for every repository`, icon: "settings" },
  { text: "Branch protection: only ktiro may merge, in every repository", icon: "lock" },
  { text: "Installed kagent agents from ktiro-agents into ktiro-system", icon: "cpu" },
  { text: "Flux reconciling platform · Flagger and flagd ready, with a reviewers-only flag segment for business review", icon: "rocket" },
  { text: `Value metric wired: ${TENANT.valueMetric.source}`, icon: "trendingUp" },
  { text: "Policy written to ktiro-intents/policy.md · WIP limits for six phases, merge lane, gates, ADR rules", icon: "sliders" },
  { text: `Invited ${PEOPLE.length} people to personal onboarding`, icon: "users" },
  { text: "knowledge-agent: first pass of the architecture map", icon: "layers" },
];

function Provision({ done, onDone }: { done: boolean; onDone: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (done) {
      setN(LOG.length);
      return;
    }
    const timers = LOG.map((_, k) => window.setTimeout(() => setN(k + 1), 550 * (k + 1)));
    timers.push(window.setTimeout(onDone, 550 * LOG.length + 500));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div class="k-card p-5 sm:p-6">
      <div class="flex items-center gap-2">
        {done ? <Icon name="check" size={18} class="text-done" /> : <span class="k-live-dot" />}
        <h2 class="k-heading !text-[17px]">{done ? `${TENANT.product} is ready` : `Provisioning ${TENANT.product}`}</h2>
        <span class="ml-auto font-mono text-[12px] text-faint">
          {n}/{LOG.length}
        </span>
      </div>
      <span class="k-track mt-3">
        <span style={{ width: `${(n / LOG.length) * 100}%`, background: done ? "var(--k-done)" : undefined }} />
      </span>
      <ol class="m-0 mt-4 flex list-none flex-col gap-0 p-0">
        {LOG.slice(0, n).map((l) => (
          <li key={l.text} class="flex animate-rise items-center gap-3 border-t border-line py-2 first:border-t-0">
            <Icon name={l.icon} size={14} class="flex-none text-muted" />
            <span class="min-w-0 flex-1 text-[13px]">{l.text}</span>
            <Icon name="check" size={13} strokeWidth={2.6} class="text-done" />
          </li>
        ))}
      </ol>
      {done ? (
        <div class="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          <a href="#/new" class="k-btn k-btn--primary">
            <Icon name="sparkles" size={14} /> Define the first intent
          </a>
          <a href="#/welcome" class="k-btn">
            <Icon name="user" size={14} /> Your personal onboarding
          </a>
          <a href="#/flow" class="k-btn k-btn--ghost">
            See the flow
          </a>
        </div>
      ) : null}
    </div>
  );
}
