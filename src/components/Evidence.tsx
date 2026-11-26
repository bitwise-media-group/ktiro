/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// Recorded evidence for customer-facing changes. In the real system these are
// screenshots and videos the review agent captures in a preview environment;
// here they are drawn mocks of Ledgerline's portal, so the prototype needs no
// assets. Every mock is designed at 560px wide and scaled with CSS zoom.

import { useEffect, useState } from "preact/hooks";
import type { Evidence } from "../types";
import { Icon } from "./icons";

function Frame({ url, children }: { url: string; children: preact.ComponentChildren }) {
  return (
    <div class="overflow-hidden rounded-[10px] border border-line-2 bg-[#f6f7f9] text-[#1b2330]" style={{ width: "560px" }}>
      <div class="flex items-center gap-2 border-b border-[#dfe3e8] bg-[#eceff3] px-3 py-2">
        <span class="flex gap-1.5">
          <span class="size-2.5 rounded-full bg-[#f2766b]" />
          <span class="size-2.5 rounded-full bg-[#f4c04e]" />
          <span class="size-2.5 rounded-full bg-[#5dc56b]" />
        </span>
        <span class="ml-2 flex-1 rounded-md bg-white px-2.5 py-1 font-mono text-[11px] text-[#5b6675]">{url}</span>
      </div>
      <div class="flex">
        <div class="w-[118px] flex-none border-r border-[#e3e6ea] bg-white px-3 py-4 text-[12px]">
          <div class="mb-4 flex items-center gap-1.5 font-bold text-[#123]">
            <span class="size-3.5 rounded-[4px] bg-[#2b59c3]" /> Ledgerline
          </div>
          {["Overview", "Invoices", "Plan & seats", "Payment", "Team"].map((x) => (
            <div key={x} class={`rounded px-1.5 py-1 ${x === (url.includes("invoices") ? "Invoices" : "Plan & seats") ? "bg-[#e8eefb] font-semibold text-[#2b59c3]" : "text-[#5b6675]"}`}>
              {x}
            </div>
          ))}
        </div>
        <div class="min-h-[300px] flex-1 p-5">{children}</div>
      </div>
    </div>
  );
}

function PlanChange({ variant }: { variant: "before" | "upgrade" | "credit" }) {
  const up = variant !== "credit";
  return (
    <Frame url="app.ledgerline.com/settings/plan/change">
      <div class="text-[11px] font-semibold tracking-wide text-[#6b7685] uppercase">Change plan</div>
      <div class="mt-1 text-[18px] font-bold">{up ? "Starter → Growth" : "Growth → Starter"}</div>
      <div class="mt-0.5 text-[12.5px] text-[#5b6675]">{up ? "£640 / month from your next bill · 14 seats" : "£290 / month from your next bill · 14 seats"}</div>
      {variant === "before" ? (
        <div class="mt-6 rounded-lg border border-dashed border-[#c9ced6] p-4 text-center text-[12px] text-[#8a94a3]">No information about today's charge</div>
      ) : (
        <div class="mt-4 rounded-lg border border-[#e1e5ea] bg-white">
          <div class="border-b border-[#eef0f3] px-3.5 py-2 text-[12px] font-semibold">{up ? "Charged today" : "Credit on your next invoice"}</div>
          <div class="space-y-1.5 px-3.5 py-2.5 text-[12px]">
            {up ? (
              <>
                <Row l="Growth · 14 seats × 17 days left" r="£212.40" />
                <Row l="Unused Starter · 17 days" r="−£28.20" />
              </>
            ) : (
              <>
                <Row l="Unused Growth · 9 days" r="−£192.00" />
                <Row l="Starter · 14 seats × 9 days" r="£96.00" />
              </>
            )}
          </div>
          <div class="flex justify-between border-t border-[#eef0f3] px-3.5 py-2.5 text-[13px] font-bold">
            <span>{up ? "Total today" : "Credit"}</span>
            <span style={{ color: up ? "#1b2330" : "#137a52" }}>{up ? "£184.20" : "£96.00"}</span>
          </div>
        </div>
      )}
      {variant !== "before" ? (
        <p class="mt-2.5 text-[11.5px] leading-relaxed text-[#5b6675]">
          {up
            ? "You pay the difference for the 17 days left in this billing period. Your next full bill is £640 on 12 December."
            : "You've paid for Growth until 12 December, so the unused part comes back as a credit on your next invoice."}
        </p>
      ) : null}
      <div class="mt-4 flex gap-2">
        <span class="rounded-md bg-[#2b59c3] px-3 py-1.5 text-[12px] font-semibold text-white">Confirm change</span>
        <span class="rounded-md border border-[#d3d8df] px-3 py-1.5 text-[12px]">Cancel</span>
      </div>
    </Frame>
  );
}

const Row = ({ l, r }: { l: string; r: string }) => (
  <div class="flex justify-between gap-4">
    <span class="text-[#3d4756]">{l}</span>
    <span class="font-mono">{r}</span>
  </div>
);

function DatePicker({ zone, wrong }: { zone: string; wrong?: boolean }) {
  const days = Array.from({ length: 35 }, (_, i) => i - 5);
  return (
    <Frame url="app.ledgerline.com/invoices?issued=2026-12-01">
      <div class="flex items-center justify-between">
        <div class="text-[16px] font-bold">Invoices</div>
        <span class="rounded-full bg-[#eef1f5] px-2 py-0.5 font-mono text-[10.5px] text-[#5b6675]">{zone}</span>
      </div>
      <div class="mt-3 flex items-center gap-2">
        <span
          class="rounded-full border px-2.5 py-1 text-[12px] font-semibold"
          style={wrong ? { borderColor: "#e0a33a", background: "#fff6e5", color: "#8a5400" } : { borderColor: "#b9c8ec", background: "#eef3fd", color: "#2b59c3" }}
        >
          Issued on {wrong ? "30 Nov" : "1 Dec"}
        </span>
        <span class="text-[11.5px] text-[#8a94a3]">{wrong ? "0 invoices" : "38 invoices"}</span>
      </div>
      <div class="mt-3 w-[230px] rounded-lg border border-[#e1e5ea] bg-white p-2.5 shadow-sm">
        <div class="mb-1.5 text-center text-[12px] font-semibold">December 2026</div>
        <div class="grid grid-cols-7 gap-0.5 text-center text-[10.5px]">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} class="text-[#8a94a3]">
              {d}
            </span>
          ))}
          {days.map((d) => (
            <span
              key={d}
              class="rounded py-0.5"
              style={d === 1 ? { background: "#2b59c3", color: "white", fontWeight: 700 } : d < 1 ? { color: "#c2c8d0" } : undefined}
            >
              {d < 1 ? 30 + d : d > 31 ? d - 31 : d}
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function ZipExport() {
  return (
    <Frame url="app.ledgerline.com/invoices/export">
      <div class="text-[16px] font-bold">Invoices</div>
      <div class="mt-3 rounded-lg border border-[#e1e5ea] bg-white p-4 shadow-sm">
        <div class="text-[13px] font-bold">Download a year of invoices</div>
        <div class="mt-2 flex gap-2 text-[12px]">
          <span class="rounded-md border border-[#d3d8df] px-2.5 py-1">1 Jan 2025</span>
          <span class="py-1 text-[#8a94a3]">to</span>
          <span class="rounded-md border border-[#d3d8df] px-2.5 py-1">31 Dec 2025</span>
        </div>
        <div class="mt-2 text-[11.5px] text-[#5b6675]">412 invoices and 9 credit notes · about 38 MB</div>
        <div class="mt-3 inline-block rounded-md bg-[#2b59c3] px-3 py-1.5 text-[12px] font-semibold text-white">Download ZIP</div>
      </div>
    </Frame>
  );
}

function Mock({ id }: { id: string }) {
  switch (id) {
    case "e1":
      return <ZipExport />;
    case "e2":
    case "e4":
      return <PlanChange variant="upgrade" />;
    case "e3":
      return <PlanChange variant="credit" />;
    case "e5":
      return <PlanChange variant="before" />;
    case "e6":
      return <DatePicker zone="Asia/Tokyo" />;
    case "e7":
      return <DatePicker zone="Pacific/Auckland" />;
    case "e8":
      return <DatePicker zone="Asia/Tokyo" wrong />;
    default:
      return <PlanChange variant="upgrade" />;
  }
}

function Shot({ ev, zoom }: { ev: Evidence; zoom: number }) {
  return (
    <div class="relative" style={{ zoom }}>
      <Mock id={ev.id} />
      {ev.kind === "video" ? (
        <>
          <div class="absolute inset-0 grid place-items-center rounded-[10px] bg-black/25">
            <span class="grid size-16 place-items-center rounded-full bg-black/60 text-white">
              <Icon name="play" size={28} />
            </span>
          </div>
          {ev.id === "e4" ? (
            <div class="absolute inset-x-6 bottom-5 rounded-md bg-black/75 px-3 py-2 font-mono text-[12px] text-white">
              VoiceOver: "Charged today, £184.20. You pay the difference for the 17 days left…"
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function EvidenceThumb({ ev, onOpen }: { ev: Evidence; onOpen: () => void }) {
  return (
    <button type="button" class="group w-[200px] flex-none cursor-pointer border-0 bg-transparent p-0 text-left" onClick={onOpen}>
      <div class="relative overflow-hidden rounded-[10px] border border-line transition-colors group-hover:border-accent">
        <Shot ev={ev} zoom={200 / 560} />
        {ev.before ? <span class="absolute top-2 left-2 k-pill k-pill--amber bg-surface">before</span> : null}
      </div>
      <div class="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold">
        <Icon name={ev.kind === "video" ? "video" : "image"} size={13} class="text-muted" />
        {ev.title}
      </div>
    </button>
  );
}

export function EvidenceStrip({ items }: { items: Evidence[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div class="flex gap-3 overflow-x-auto pb-1">
        {items.map((ev, i) => (
          <EvidenceThumb key={ev.id} ev={ev} onOpen={() => setOpen(i)} />
        ))}
      </div>
      {open !== null ? <Viewer items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function Viewer({ items, index, onIndex, onClose }: { items: Evidence[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const ev = items[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex(Math.min(items.length - 1, index + 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(0, index - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index]);
  return (
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={ev.title}>
      <div class="k-card max-w-[860px] p-5 shadow-strong" onClick={(e) => e.stopPropagation()}>
        <div class="mb-3 flex items-center gap-2">
          <Icon name={ev.kind === "video" ? "video" : "image"} size={16} class="text-muted" />
          <strong>{ev.title}</strong>
          {ev.before ? <span class="k-pill k-pill--amber">before</span> : <span class="k-pill k-pill--done">after</span>}
          <span class="ml-auto font-mono text-[12px] text-faint">
            {index + 1} / {items.length}
          </span>
          <button type="button" class="k-btn k-btn--ghost k-btn--sm" onClick={onClose} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </div>
        <div class="overflow-auto">
          <Shot ev={ev} zoom={Math.min(1.4, (Math.min(window.innerWidth, 860) - 72) / 560)} />
        </div>
        <p class="mt-3 mb-0 text-[13.5px] text-muted">{ev.caption}</p>
        <div class="mt-3 flex justify-between">
          <button type="button" class="k-btn k-btn--sm" disabled={index === 0} onClick={() => onIndex(index - 1)}>
            <Icon name="arrowLeft" size={14} /> Previous
          </button>
          <span class="self-center font-mono text-[11.5px] text-faint">captured by review-agent in preview · stored in ktiro-intents</span>
          <button type="button" class="k-btn k-btn--sm" disabled={index === items.length - 1} onClick={() => onIndex(index + 1)}>
            Next <Icon name="arrowRight" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
