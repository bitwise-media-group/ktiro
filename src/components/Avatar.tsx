/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// People are circles; agents are rounded squares with a glyph. Shape, not
// hue, tells them apart.

import { agent, person } from "../data/org";
import type { AgentId, Speaker } from "../types";
import { Icon, type IconName } from "./icons";

export const AGENT_ICON: Record<AgentId, IconName> = {
  orchestrator: "target",
  definer: "sparkles",
  planner: "layers",
  engineering: "terminal",
  review: "eye",
  security: "shield",
  operations: "rocket",
  knowledge: "book",
  process: "wand",
};

export function PersonAvatar({ id, size = 26 }: { id: string; size?: number }) {
  const p = person(id);
  return (
    <span
      class="grid flex-none place-items-center rounded-full font-semibold"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.round(size * 0.4)}px`,
        color: `color-mix(in oklab, hsl(${p.hue} 65% 55%) 55%, var(--k-fg))`,
        background: `color-mix(in oklab, hsl(${p.hue} 60% 50%) 20%, var(--k-surface))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, hsl(${p.hue} 60% 50%) 40%, transparent)`,
      }}
      title={p.name}
      aria-hidden="true"
    >
      {p.initials}
    </span>
  );
}

export function AgentAvatar({ id, size = 26 }: { id: AgentId; size?: number }) {
  return (
    <span
      class="grid flex-none place-items-center rounded-[7px] border text-ink"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderColor: "color-mix(in oklab, var(--k-accent) 40%, transparent)",
        background: "color-mix(in oklab, var(--k-accent) 12%, var(--k-surface))",
      }}
      title={agent(id).name}
      aria-hidden="true"
    >
      <Icon name={AGENT_ICON[id]} size={Math.round(size * 0.55)} />
    </span>
  );
}

export function SpeakerAvatar({ from, size = 28 }: { from: Speaker; size?: number }) {
  if (from.kind === "agent") return <AgentAvatar id={from.id} size={size} />;
  if (from.kind === "person") return <PersonAvatar id={from.id} size={size} />;
  return (
    <span class="grid flex-none place-items-center rounded-full border border-dashed border-line-2 text-faint" style={{ width: `${size}px`, height: `${size}px` }}>
      <Icon name="gitCommit" size={Math.round(size * 0.5)} />
    </span>
  );
}

export function speakerName(from: Speaker): string {
  if (from.kind === "agent") return agent(from.id).name;
  if (from.kind === "person") return person(from.id).name;
  return "ktiro";
}

export function AvatarStack({ ids, size = 22 }: { ids: string[]; size?: number }) {
  return (
    <span class="flex -space-x-1.5">
      {ids.map((id) => (
        <span key={id} class="rounded-full ring-2 ring-surface">
          <PersonAvatar id={id} size={size} />
        </span>
      ))}
    </span>
  );
}
