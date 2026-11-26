/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// The top bar: brand and tenant, the views (flat text, the current one carrying
// an accent rule on the header's bottom edge), then the new-intent action, the
// persona switcher (the prototype's "preview as"), onboarding links and the
// theme toggle. Below lg the views scroll horizontally in a second row.

import { useEffect, useRef, useState } from "preact/hooks";
import { PERSONAS, person, TENANT } from "../data/org";
import type { Route } from "../router";
import { setMe, useMe, useStore } from "../store";
import { PersonAvatar } from "./Avatar";
import { Icon, type IconName } from "./icons";
import { Mark } from "./Mark";
import { openAsks } from "./Thread";

const NAV: { view: Route["view"]; href: string; label: string; icon: IconName }[] = [
  { view: "home", href: "#/", label: "My work", icon: "inbox" },
  { view: "flow", href: "#/flow", label: "Flow", icon: "columns" },
  { view: "backlog", href: "#/backlog", label: "Backlog", icon: "list" },
  { view: "insights", href: "#/insights", label: "Insights", icon: "barChart" },
  { view: "agents", href: "#/agents", label: "Agents", icon: "bot" },
  { view: "knowledge", href: "#/knowledge", label: "Knowledge", icon: "book" },
];

const NAV_LINK =
  "relative inline-flex h-full items-center gap-1.5 px-3 text-[14px] font-semibold no-underline transition-colors hover:text-fg " +
  "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-t-full after:content-['']";

function ThemeToggle() {
  const [light, setLight] = useState(() => document.body.classList.contains("theme-ktiro-light"));
  const toggle = () => {
    const next = !light;
    document.body.classList.replace(next ? "theme-ktiro" : "theme-ktiro-light", next ? "theme-ktiro-light" : "theme-ktiro");
    try {
      localStorage.setItem("ktiro-theme", next ? "light" : "dark");
    } catch {
      /* storage may be unavailable */
    }
    setLight(next);
  };
  return (
    <button type="button" class="k-btn k-btn--ghost k-btn--sm !px-2" onClick={toggle} aria-label={light ? "Switch to dark theme" : "Switch to light theme"}>
      <Icon name={light ? "moon" : "sun"} size={16} />
    </button>
  );
}

function PersonaMenu() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const p = person(me);
  return (
    <div class="relative" ref={ref}>
      <button
        type="button"
        class="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line-2 bg-transparent py-1 pr-2 pl-1.5 text-fg"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <PersonAvatar id={me} size={24} />
        <span class="hidden text-left leading-tight sm:block">
          <span class="block text-[12.5px] font-semibold">{p.name}</span>
          <span class="block text-[11px] text-faint">Preview as</span>
        </span>
        <Icon name="chevronDown" size={14} class="text-muted" />
      </button>
      {open ? (
        <div class="absolute top-full right-0 z-40 mt-2 w-[270px] rounded-[10px] border border-line-2 bg-surface p-1.5 shadow-strong" role="menu">
          <div class="px-2.5 pt-1.5 pb-1 k-eyebrow">Preview as</div>
          {PERSONAS.map((id) => {
            const x = person(id);
            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={id === me}
                class={`flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 px-2.5 py-2 text-left hover:bg-surface-2 ${id === me ? "bg-surface-2" : "bg-transparent"}`}
                onClick={() => {
                  setMe(id);
                  setOpen(false);
                }}
              >
                <PersonAvatar id={id} size={26} />
                <span class="min-w-0 flex-1">
                  <span class="block text-[13.5px] font-semibold text-fg">{x.name}</span>
                  <span class="block text-[12px] text-muted">{x.role}</span>
                </span>
                {id === me ? <Icon name="check" size={14} class="text-ink" /> : null}
              </button>
            );
          })}
          <div class="mx-1 my-1.5 h-px bg-line" />
          <a href="#/welcome" class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] text-fg no-underline hover:bg-surface-2" onClick={() => setOpen(false)}>
            <Icon name="user" size={15} class="text-muted" /> Skills, interests & availability
          </a>
          <a href="#/setup" class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] text-fg no-underline hover:bg-surface-2" onClick={() => setOpen(false)}>
            <Icon name="settings" size={15} class="text-muted" /> Tenant setup
          </a>
        </div>
      ) : null}
    </div>
  );
}

export function TopBar({ route }: { route: Route }) {
  const me = useMe();
  const asks = useStore((s) => openAsks(s.intents, me).length);
  const links = NAV.map((n) => {
    const active = route.view === n.view;
    return (
      <a
        key={n.view}
        href={n.href}
        class={`${NAV_LINK} ${active ? "text-fg after:bg-accent" : "text-muted after:bg-transparent"}`}
        aria-current={active ? "page" : undefined}
      >
        {n.label}
        {n.view === "home" && asks > 0 ? <span class="k-count k-count--amber">{asks}</span> : null}
      </a>
    );
  });
  return (
    <header class="sticky top-0 z-30 border-b border-line bg-[color-mix(in_oklab,var(--k-bg)_88%,transparent)] backdrop-blur-md">
      <div class="mx-auto flex h-[60px] max-w-[1360px] items-center gap-4 px-4 sm:px-6">
        <a href="#/" class="flex items-center gap-2.5 text-fg no-underline" aria-label="ktiro home">
          <Mark size={26} />
          <span class="text-[18px] font-bold tracking-[-0.01em]">ktiro</span>
        </a>
        <span class="hidden items-center gap-1.5 rounded-md border border-line px-2 py-1 font-mono text-[12px] text-muted md:inline-flex" title={TENANT.tagline}>
          <Icon name="box" size={13} /> {TENANT.product}
        </span>
        <nav class="hidden h-full items-stretch lg:flex" aria-label="Views">
          {links}
        </nav>
        <div class="ml-auto flex items-center gap-2">
          <span class="k-pill k-pill--neutral hidden xl:inline-flex">Demo data</span>
          <a href="#/new" class="k-btn k-btn--primary k-btn--sm !min-h-8">
            <Icon name="plus" size={14} strokeWidth={2.4} /> <span class="hidden sm:inline">New intent</span>
          </a>
          <PersonaMenu />
          <ThemeToggle />
        </div>
      </div>
      <nav class="flex h-11 items-stretch overflow-x-auto border-t border-line px-2 lg:hidden" aria-label="Views">
        {links}
      </nav>
    </header>
  );
}
