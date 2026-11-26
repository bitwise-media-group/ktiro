/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

import { useStore } from "../store";
import { Icon } from "./icons";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div class="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100vw-32px))] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} class={`k-note k-note--${t.tone === "amber" ? "" : t.tone} pointer-events-auto animate-rise bg-surface shadow-strong`}>
          <Icon name={t.tone === "done" ? "check" : t.tone === "amber" ? "alertTriangle" : "zap"} size={15} class="mt-0.5 flex-none" />
          <span class="min-w-0 flex-1 text-fg">{t.text}</span>
          {t.href ? (
            <a href={t.href} class="font-semibold whitespace-nowrap">
              Open
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}
