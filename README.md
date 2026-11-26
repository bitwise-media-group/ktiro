# ktiro

A clickable prototype of an end-to-end, intent-driven software factory. It is demo data only: nothing is persisted,
nothing talks to a forge or a cluster, and a reload resets the story. Its job is to make the way of working concrete
enough to argue about.

The demo tenant is **Ledgerline**, a fictional B2B billing platform with eight repositories, six people and nine agents.

```sh
git submodule update --init && mise trust --all   # once per clone
make dev                                          # http://localhost:5173, hot reload
make build                                        # one self-contained dist/index.html
make screenshots                                  # every view, both themes (outside the Claude Code sandbox)
```

The stack matches patchy's status page: Preact, Bun and Tailwind 4, on the shared toolchain's `node` archetype. The
palette is patchy's, re-tinted from verdigris toward azure (`src/styles/tokens.css`).

## Deploying

The code, its image and its manifests live together in this repo, on the same supply chain as the platform's other
applications:

- `server.ts` and the `Dockerfile`: the page plus a tiny Bun server (gzip, ETag, CSP, `/_/healthz`, `/_/version`),
  compiled to one binary on distroless for amd64 and arm64. `bun run start` serves the last build locally.
- `patchy.yaml`: `patchy build` publishes `images/ktiro` and the `manifests/ktiro` Flux artifact. The release workflow
  signs both on every push to `main` as an edge build (`<version>-edge.<timestamp>.g<commit>`), and promotes the newest
  one to `vX.Y.Z` when release-please cuts a release.
- `manifests/{common,google}`: the namespace, the server, its public HTTPRoute at `<KTIRO_HOST>.<PLATFORM_DOMAIN>`, the
  image provider that follows the edge channel, and the Kyverno policy that verifies this repo's own signature.
- `modules/google`: installs it onto a [terraform-google-gke-flux] cluster through that repo's `modules/application`.
  The patchy cluster calls it from `cloud-accounts/environments/google/patchy-app`.

It is deliberately public, with no sign-in: the prototype runs on demo data only.

[terraform-google-gke-flux]: https://github.com/bitwise-media-group/terraform-google-gke-flux

## The model

- **One artifact: the intent.** A feature, a bug, a security fix and a data-integrity repair are all intents; size never
  creates a new artifact type. An intent must be small enough for one **orchestrator** agent to own end to end in a
  single context window (it may use any number of sub-agents). The definer agent measures _context fit_ and splits
  anything too big into sibling intents with dependencies (see 0143 and 0153).
- **Every intent carries an outcome**: a rubric of gradable criteria, each checked by the outcome grader, tests, a
  benchmark, the canary, or (rarely) a person. This is the same idea as an Outcome in Claude Managed Agents: a
  definition of done that a grader iterates against. It lives inside the intent, not as a planning tier above it.
- **Phases:** Defining → Planning → Engineering → Technical review → Business review → Operate. Intents are the
  artifact; _defining_ is the phase that produces one. Each phase has a strict work-in-progress limit; anything over it
  queues, and the highest-priority queued intent is pulled when a slot frees.
- **Gates** sit between phases. A person decides, unless the agent's forecast p(success) is high and the impact low
  enough for the tenant's auto-skip policy.
- **Technical review belongs to agents**: code review, security review and the outcome grader run in parallel and blind.
  A person is pulled in only when an agent hits a wall, or to agree a **net-new ADR**, which always needs a person
  (0138). Planning is the other place ADRs move: it may recommend changing an existing one, against a deliberately high
  burden of proof (0143).
- **Business review is where people see results**, live in production behind a feature flag that is on for reviewers
  only, alongside recorded screenshots and video (0135, 0144). Accepting the results starts the flag's first rollout to
  customers.
- **Agents stop and ask.** At a decision branch or when confidence is low, an agent raises a question, modelled on
  Claude Code's own interruptions: a header, numbered options with one recommended, an optional preview, and "Other".
  The question is assigned to people by skill, interest, authorship, or as a stretch assignment.
- **Prioritisation:** criticality (set by agents, never people: security > data integrity > feature > bug), then value
  (the tenant's _one_ measurable metric, here ARR impact), then human importance. A share of capacity is reserved for
  bugs.
- **Merging is per intent, not per repository.** Every pull request in an intent's merge set is opened, green and
  approved before any merges; when technical review passes, ktiro merges them together in the **merge lane**, one intent
  at a time, and deploys them dark into business review. People never push or merge, and they review the _results_ of
  the intent rather than its pull requests; the code is one click away if they want it.
- **Operate** ramps the OpenFeature flag across accounts against a control group, with a burn-in. The value metric is
  measured on the exposed cohort and compared with the estimate.
- **Done means the flag is at 100% and removed from the code.** Removal is a **fast-path** intent raised by the
  operations agent: no functional change, so it skips business review and rides alongside the WIP limits (0133 and
  0155).
- **Findings** from patchy (scanner alerts accumulated, investigated and triaged) become security intents, which always
  jump the queue (0141, 0151). _Insights_ follows them from alert to done.
- **Git is the data store.** Every intent, plan, HIL decision, run report and piece of evidence is markdown in
  `ktiro-intents`; agents are declared in `ktiro-agents`; the knowledge base is `ktiro-docs`. The UI is a view of those
  files; the forge is never a workplace.
- **We measure intents, not people**: time queued, time with agents working, time waiting on people, cost and HIL count,
  per phase.
- **The process agent** reads every HIL interaction from engineering and review and proposes changes to the agents, the
  toolchain and the workflows, raised as intents of their own (0145).
- **Every repository is the same**: one toolchain, one set of reusable workflows, one docs site maintained by the
  engineering agent as part of the definition of done, alongside tests and benchmarks.

## A five-minute walkthrough

Use **Preview as** (top right) to switch persona; each one has something waiting.

1. **Dana** (staff engineer): _My work_ shows an engineering agent stopped on 0139, choosing an idempotency key. Answer
   it and watch engineering finish, technical review pass without a person, the merge set merge and deploy dark, and the
   intent land in business review. Dana is also asked to agree net-new ADR-0014 on 0138.
2. **Kai** (designer): 0135 is live behind its flag. Open _Business review_ for the live link, the before/after evidence
   and the outcome, then accept: the rollout starts at 5% and business review's freed slot pulls the next intent in.
3. **Tomás** (product): 0143's plan spans four repositories and recommends changing ADR-0009. Approve it and it queues
   for engineering, which is at its limit.
4. On 0128, _Operate_, advance the burn-in to 100%: the operations agent raises a fast-path intent to remove the flag,
   it runs through without business review, and only then is 0128 done.
5. _New intent_ walks through defining one with the definer agent. _Flow_, _Backlog_ and _Insights_ show the system as a
   whole (including intents by phase and kind, cost by kind, and findings to security intents); _Agents_ shows the
   process agent's proposals; _Knowledge_ shows ADRs and repository normalisation. Onboarding lives under the persona
   menu.

## Open questions the prototype surfaces

- Should a full business review hold merges back (as modelled), or may merged work wait dark, flag off, in a queue?
- How is the value metric attributed for factory-improving intents (0145), whose value is indirect?
- Where does a disputed criticality go, given people cannot set it?
- What counts as a "no-op" for the fast path beyond flag removal: dependency bumps, docs, refactors with identical
  snapshots?
- How long is a burn-in, per tenant or per intent, and who may shorten it?

## Layout

| Path                    | What                                                                    |
| ----------------------- | ----------------------------------------------------------------------- |
| `src/types.ts`          | The domain: intents, phases, gates, outcomes, questions, merge sets     |
| `src/data/`             | Demo data: the tenant, people, agents, repositories and intents         |
| `src/store.ts`          | In-memory state and the scripted flows (answers, gates, merges, canary) |
| `src/priority.ts`       | Pull order, WIP limits and the bug reserve                              |
| `src/components/`       | Shared UI: phase rail, thread and question cards, evidence, pills       |
| `src/views/`            | One file per view                                                       |
| `src/styles/tokens.css` | The palette, both themes                                                |
