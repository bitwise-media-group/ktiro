/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// Insights: how intents move through the factory, over the last 12 weeks.
// It measures intents (how long each waited, what it cost, where a person was
// needed), never the people working on them.
//
// Chart colours are chart-only steps of the app's tones, validated with the
// dataviz palette checker against both chart surfaces (lightness band, chroma,
// CVD and normal-vision separation, contrast):
//   kinds  dark  #e2507a #bd7425 #7083e8 #a08e22 · light #a8105a #c76c00 #3d4fc4 #857000
//   lead   dark  #5f6c79 #4a93dc #b8862a         · light #8a96a3 #1d62b0 #a86200
// (the grey "queued" swatch is the deliberate de-emphasised neutral). Every
// chart has a legend for 2+ series, a hover/focus tooltip and a table view.

import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import {
  AUTO_SKIP,
  CANARY,
  COST_BY_KIND,
  COST_BY_PHASE,
  FEATURE_LEAD_DAYS,
  FINDING_COST,
  FINDING_MTTR_DAYS,
  FINDING_SOURCE_LABEL,
  FINDINGS,
  HIL_RATE,
  LEAD_PART_LABEL,
  LEAD_TIME,
  REGRET,
  SKIPPED_GATES,
  THROUGHPUT,
  VALUE_ESTIMATED,
  VALUE_MEASURED,
  WEEKS,
  type LeadPart,
} from "../data/metrics";
import { Icon } from "../components/icons";
import { KindPill } from "../components/Pills";
import { hours, KIND_LABEL, PHASE_LABEL, sum, usd } from "../format";
import { hrefIntent } from "../router";
import { useStore } from "../store";
import { KINDS, type Kind } from "../types";
import { PhaseKindMatrix } from "./Backlog";

const CHART_CSS = `
.theme-ktiro .k-viz {
  --viz-security: #e2507a; --viz-data: #bd7425; --viz-feature: #7083e8; --viz-bug: #a08e22;
  --viz-queued: #5f6c79; --viz-working: #4a93dc; --viz-waiting: #b8862a;
  --viz-estimate: #5f6c79; --viz-measured: #3aa883;
}
.theme-ktiro-light .k-viz {
  --viz-security: #a8105a; --viz-data: #c76c00; --viz-feature: #3d4fc4; --viz-bug: #857000;
  --viz-queued: #8a96a3; --viz-working: #1d62b0; --viz-waiting: #a86200;
  --viz-estimate: #8a96a3; --viz-measured: #0d7a5a;
}
.k-viz .mark { transition: opacity 120ms; }
.k-viz .is-dim .mark { opacity: 0.45; }
.k-viz .is-dim .is-hot .mark { opacity: 1; }
`;

const KIND_VAR: Record<Kind, string> = {
  security: "var(--viz-security)",
  "data-integrity": "var(--viz-data)",
  feature: "var(--viz-feature)",
  bug: "var(--viz-bug)",
};
const LEAD_VAR: Record<LeadPart, string> = { queued: "var(--viz-queued)", working: "var(--viz-working)", waiting: "var(--viz-waiting)" };
const LEAD_PARTS: LeadPart[] = ["queued", "working", "waiting"];

// ───────────────────────────── chart kit ─────────────────────────────

function useWidth<T extends HTMLElement>(): [preact.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(560);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

interface Tip {
  x: number;
  y: number;
  title: string;
  rows: { color: string; label: string; value: string }[];
}

function Tooltip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  const left = Math.min(Math.max(8, tip.x + 12), width - 190);
  return (
    <div
      class="pointer-events-none absolute z-10 w-[180px] rounded-lg border border-line-2 bg-surface px-3 py-2 shadow-strong"
      style={{ left: `${left}px`, top: `${Math.max(0, tip.y - 12)}px` }}
      role="status"
    >
      <div class="text-[11.5px] text-muted">{tip.title}</div>
      {tip.rows.map((r) => (
        <div key={r.label} class="mt-1 flex items-center gap-2 text-[12px]">
          <span class="h-0.5 w-3 flex-none rounded-full" style={{ background: r.color }} />
          <strong class="font-mono text-[12.5px] text-fg">{r.value}</strong>
          <span class="min-w-0 truncate text-muted">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Column path: 4px rounded data-end on top, square at the baseline. */
function colPath(x: number, y: number, w: number, h: number, round: boolean) {
  if (h <= 0) return "";
  const r = round ? Math.min(4, h, w / 2) : 0;
  return `M${x},${y + h}L${x},${y + r}Q${x},${y} ${x + r},${y}L${x + w - r},${y}Q${x + w},${y} ${x + w},${y + r}L${x + w},${y + h}Z`;
}
/** Horizontal bar path: rounded data-end on the right, square at the baseline. */
function barPath(x: number, y: number, w: number, h: number, round: boolean) {
  if (w <= 0) return "";
  const r = round ? Math.min(4, w, h / 2) : 0;
  return `M${x},${y}L${x + w - r},${y}Q${x + w},${y} ${x + w},${y + r}L${x + w},${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}L${x},${y + h}Z`;
}

function niceMax(v: number) {
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= v) return m * step;
  return 10 * step;
}

function Legend({ items, mark = "rect" }: { items: { label: string; color: string }[]; mark?: "rect" | "line" }) {
  return (
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
      {items.map((it) => (
        <span key={it.label} class="inline-flex items-center gap-1.5">
          {mark === "rect" ? <span class="k-swatch" style={{ background: it.color }} /> : <span class="h-0.5 w-3.5 rounded-full" style={{ background: it.color }} />}
          {it.label}
        </span>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  legend,
  table,
  wide,
  children,
}: {
  wide?: boolean;
  title: string;
  subtitle: string;
  legend?: ComponentChildren;
  table: { head: string[]; rows: (string | number)[][] };
  children: ComponentChildren;
}) {
  return (
    <section class={`k-card k-card--pad flex min-w-0 flex-col ${wide ? "lg:col-span-2" : ""}`}>
      <h2 class="k-heading !text-[14px]">{title}</h2>
      <p class="mt-0.5 mb-0 text-[12.5px] text-muted">{subtitle}</p>
      {legend ? <div class="mt-3">{legend}</div> : null}
      <div class="mt-3 flex-1">{children}</div>
      <details class="mt-2 text-[12.5px]">
        <summary class="cursor-pointer text-muted hover:text-fg">Show as table</summary>
        <div class="mt-2 overflow-x-auto rounded-lg border border-line">
          <table class="k-table !text-[12.5px]">
            <thead>
              <tr>
                {table.head.map((h, k) => (
                  <th key={h} class={k ? "num" : ""}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, k) => (
                <tr key={k}>
                  {r.map((c, j) => (
                    <td key={j} class={j ? "num" : ""}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

const AXIS = "var(--k-faint)";
const GRID = "var(--k-line)";

// ── Stacked weekly columns (throughput by kind) ──
function ThroughputChart() {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hot, setHot] = useState<number | null>(null);
  const H = 220;
  const pad = { l: 28, r: 8, t: 10, b: 26 };
  const totals = WEEKS.map((_, i) => sum(KINDS.map((k) => THROUGHPUT[k][i])));
  const max = niceMax(Math.max(...totals));
  const iw = w - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const band = iw / WEEKS.length;
  const bw = Math.min(24, band * 0.62);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, max / 2, max];
  const show = (i: number, x: number) => {
    setHot(i);
    setTip({
      x,
      y: y(totals[i]) - 8,
      title: `Week of ${WEEKS[i]} · ${totals[i]} shipped`,
      rows: [...KINDS].reverse().map((k) => ({ color: KIND_VAR[k], label: KIND_LABEL[k], value: String(THROUGHPUT[k][i]) })),
    });
  };
  const hide = () => (setHot(null), setTip(null));
  return (
    <div ref={ref} class="relative">
      <svg width={w} height={H} role="img" aria-label="Intents shipped per week, stacked by criticality" class={hot !== null ? "is-dim" : ""}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} stroke-width="1" />
            <text x={pad.l - 6} y={y(t) + 4} text-anchor="end" font-size="11" fill={AXIS} class="font-mono">
              {t}
            </text>
          </g>
        ))}
        {WEEKS.map((wk, i) => {
          const x = pad.l + band * i + (band - bw) / 2;
          let acc = 0;
          const top = KINDS.filter((k) => THROUGHPUT[k][i] > 0).at(-1);
          return (
            <g
              key={wk}
              class={hot === i ? "is-hot" : ""}
              tabIndex={0}
              onMouseMove={() => show(i, x + bw)}
              onMouseLeave={hide}
              onFocus={() => show(i, x + bw)}
              onBlur={hide}
              aria-label={`Week of ${wk}: ${totals[i]} shipped`}
            >
              <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" />
              {KINDS.map((k) => {
                const v = THROUGHPUT[k][i];
                if (!v) return null;
                const y0 = y(acc + v);
                const h = (v / max) * ih - (k === top ? 0 : 2);
                acc += v;
                return <path key={k} class="mark" d={colPath(x, y0, bw, h, k === top)} fill={KIND_VAR[k]} />;
              })}
              {i % 2 === 1 || w > 640 ? (
                <text x={x + bw / 2} y={H - 8} text-anchor="middle" font-size="10.5" fill={AXIS}>
                  {wk}
                </text>
              ) : null}
            </g>
          );
        })}
        <text x={pad.l + band * 11 + band / 2} y={y(totals[11]) - 6} text-anchor="middle" font-size="11.5" font-weight="700" fill="var(--k-fg)" class="font-mono">
          {totals[11]}
        </text>
      </svg>
      <Tooltip tip={tip} width={w} />
    </div>
  );
}

// ── Horizontal stacked bars (lead time by phase) ──
function LeadTimeChart() {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hot, setHot] = useState<number | null>(null);
  const rowH = 38;
  const bh = 20;
  const pad = { l: 128, r: 56 };
  const totals = LEAD_TIME.map((r) => r.queued + r.working + r.waiting);
  const max = Math.max(...totals);
  const iw = w - pad.l - pad.r;
  const H = rowH * LEAD_TIME.length;
  const show = (i: number, yy: number) => {
    const r = LEAD_TIME[i];
    setHot(i);
    setTip({
      x: pad.l + (totals[i] / max) * iw,
      y: yy,
      title: `${PHASE_LABEL[r.phase]} · ${hours(totals[i])} median`,
      rows: LEAD_PARTS.map((p) => ({ color: LEAD_VAR[p], label: LEAD_PART_LABEL[p], value: hours(r[p]) })),
    });
  };
  const hide = () => (setHot(null), setTip(null));
  return (
    <div ref={ref} class="relative">
      <svg width={w} height={H} role="img" aria-label="Median hours per phase: queued, agents working, waiting on people" class={hot !== null ? "is-dim" : ""}>
        <line x1={pad.l} x2={pad.l} y1={0} y2={H} stroke={GRID} />
        {LEAD_TIME.map((r, i) => {
          const yy = i * rowH + (rowH - bh) / 2;
          let acc = 0;
          return (
            <g key={r.phase} class={hot === i ? "is-hot" : ""} tabIndex={0} onMouseMove={() => show(i, yy)} onMouseLeave={hide} onFocus={() => show(i, yy)} onBlur={hide}>
              <rect x={0} y={i * rowH} width={w} height={rowH} fill="transparent" />
              <text x={pad.l - 10} y={yy + bh / 2 + 4} text-anchor="end" font-size="12" fill="var(--k-fg)">
                {PHASE_LABEL[r.phase]}
              </text>
              {LEAD_PARTS.map((p, j) => {
                const ww = (r[p] / max) * iw;
                const x = pad.l + acc;
                acc += ww;
                const last = j === LEAD_PARTS.length - 1;
                return <path key={p} class="mark" d={barPath(x, yy, Math.max(0, ww - (last ? 0 : 2)), bh, last)} fill={LEAD_VAR[p]} />;
              })}
              <text x={pad.l + acc + 6} y={yy + bh / 2 + 4} font-size="11.5" fill="var(--k-muted)" class="font-mono">
                {hours(totals[i])}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={w} />
    </div>
  );
}

// ── Simple horizontal bars, one series ──
function PhaseBars({ values, format, label }: { values: { phase: keyof typeof PHASE_LABEL; v: number; note?: string }[]; format: (v: number) => string; label: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hot, setHot] = useState<number | null>(null);
  const rowH = 34;
  const bh = 18;
  const pad = { l: 128, r: 56 };
  const max = Math.max(...values.map((x) => x.v));
  const iw = w - pad.l - pad.r;
  return (
    <div ref={ref}>
      <svg width={w} height={rowH * values.length} role="img" aria-label={label} class={hot !== null ? "is-dim" : ""}>
        <line x1={pad.l} x2={pad.l} y1={0} y2={rowH * values.length} stroke={GRID} />
        {values.map((r, i) => {
          const yy = i * rowH + (rowH - bh) / 2;
          const ww = (r.v / max) * iw;
          return (
            <g key={r.phase} class={hot === i ? "is-hot" : ""} tabIndex={0} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(i)} onBlur={() => setHot(null)}>
              <rect x={0} y={i * rowH} width={w} height={rowH} fill="transparent" />
              <text x={pad.l - 10} y={yy + bh / 2 + 4} text-anchor="end" font-size="12" fill="var(--k-fg)">
                {PHASE_LABEL[r.phase]}
              </text>
              <path class="mark" d={barPath(pad.l, yy, ww, bh, true)} fill="var(--viz-working)" />
              <text x={pad.l + ww + 6} y={yy + bh / 2 + 4} font-size="11.5" fill={hot === i ? "var(--k-fg)" : "var(--k-muted)"} font-weight={hot === i ? "700" : "400"} class="font-mono">
                {format(r.v)}
                {r.note ? <tspan font-family="var(--font-sans)" fill="var(--k-faint)" font-weight="400">{`  ${r.note}`}</tspan> : null}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Line over weeks, one series, with crosshair ──
function AutoSkipChart() {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [idx, setIdx] = useState<number | null>(null);
  const H = 180;
  const pad = { l: 36, r: 40, t: 12, b: 26 };
  const iw = w - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (i / (WEEKS.length - 1)) * iw;
  const y = (v: number) => pad.t + ih - v * ih;
  const d = AUTO_SKIP.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  const area = `${d}L${x(WEEKS.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const onMove = (e: PointerEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - pad.l) / iw) * (WEEKS.length - 1));
    setIdx(Math.min(WEEKS.length - 1, Math.max(0, i)));
  };
  const tip: Tip | null =
    idx === null
      ? null
      : {
          x: x(idx),
          y: y(AUTO_SKIP[idx]) - 10,
          title: `Week of ${WEEKS[idx]}`,
          rows: [
            { color: "var(--viz-working)", label: "gates skipped", value: `${Math.round(AUTO_SKIP[idx] * 100)}%` },
            { color: "var(--k-line-3)", label: "later rolled back", value: `${REGRET[idx]} of ${SKIPPED_GATES[idx]}` },
          ],
        };
  return (
    <div ref={ref} class="relative">
      <svg
        width={w}
        height={H}
        role="img"
        aria-label="Share of gates skipped by agents, per week"
        onPointerMove={onMove}
        onPointerLeave={() => setIdx(null)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setIdx(Math.min(11, (idx ?? -1) + 1));
          if (e.key === "ArrowLeft") setIdx(Math.max(0, (idx ?? 12) - 1));
        }}
        onBlur={() => setIdx(null)}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={pad.l - 6} y={y(t) + 4} text-anchor="end" font-size="11" fill={AXIS} class="font-mono">
              {t * 100}%
            </text>
          </g>
        ))}
        <path d={area} fill="var(--viz-working)" opacity="0.1" />
        <path d={d} fill="none" stroke="var(--viz-working)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        {REGRET.map((r, i) =>
          r ? (
            <g key={i}>
              <line x1={x(i)} x2={x(i)} y1={y(AUTO_SKIP[i]) + 8} y2={y(0)} stroke="var(--k-line-3)" stroke-width="1" />
              <circle cx={x(i)} cy={y(0) - 4} r="4" fill="var(--k-surface)" stroke="var(--k-line-3)" stroke-width="2" />
            </g>
          ) : null,
        )}
        <circle cx={x(11)} cy={y(AUTO_SKIP[11])} r="4" fill="var(--viz-working)" stroke="var(--k-surface)" stroke-width="2" />
        <text x={x(11) + 8} y={y(AUTO_SKIP[11]) + 4} font-size="11.5" font-weight="700" fill="var(--k-fg)" class="font-mono">
          {Math.round(AUTO_SKIP[11] * 100)}%
        </text>
        {WEEKS.map((wk, i) =>
          i % 3 === 0 || i === 11 ? (
            <text key={wk} x={x(i)} y={H - 8} text-anchor="middle" font-size="10.5" fill={AXIS}>
              {wk}
            </text>
          ) : null,
        )}
        {idx !== null ? (
          <>
            <line x1={x(idx)} x2={x(idx)} y1={pad.t} y2={y(0)} stroke="var(--k-line-3)" stroke-width="1" />
            <circle cx={x(idx)} cy={y(AUTO_SKIP[idx])} r="4" fill="var(--viz-working)" stroke="var(--k-surface)" stroke-width="2" />
          </>
        ) : null}
      </svg>
      <Tooltip tip={tip} width={w} />
    </div>
  );
}

// ── Grouped weekly columns: estimated vs measured value ──
function ValueChart() {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hot, setHot] = useState<number | null>(null);
  const H = 200;
  const pad = { l: 40, r: 8, t: 10, b: 26 };
  const max = niceMax(Math.max(...VALUE_ESTIMATED, ...VALUE_MEASURED));
  const iw = w - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const band = iw / WEEKS.length;
  const bw = Math.min(12, (band * 0.7) / 2);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const show = (i: number, x: number) => {
    setHot(i);
    setTip({
      x,
      y: y(Math.max(VALUE_ESTIMATED[i], VALUE_MEASURED[i])) - 8,
      title: `Week of ${WEEKS[i]}`,
      rows: [
        { color: "var(--viz-measured)", label: "measured", value: `£${VALUE_MEASURED[i]}k` },
        { color: "var(--viz-estimate)", label: "estimated", value: `£${VALUE_ESTIMATED[i]}k` },
      ],
    });
  };
  const hide = () => (setHot(null), setTip(null));
  return (
    <div ref={ref} class="relative">
      <svg width={w} height={H} role="img" aria-label="ARR impact shipped per week, estimated versus measured" class={hot !== null ? "is-dim" : ""}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={pad.l - 6} y={y(t) + 4} text-anchor="end" font-size="11" fill={AXIS} class="font-mono">
              £{t}k
            </text>
          </g>
        ))}
        {WEEKS.map((wk, i) => {
          const x0 = pad.l + band * i + (band - (bw * 2 + 2)) / 2;
          return (
            <g key={wk} class={hot === i ? "is-hot" : ""} tabIndex={0} onMouseMove={() => show(i, x0 + bw * 2)} onMouseLeave={hide} onFocus={() => show(i, x0 + bw * 2)} onBlur={hide}>
              <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" />
              <path class="mark" d={colPath(x0, y(VALUE_ESTIMATED[i]), bw, (VALUE_ESTIMATED[i] / max) * ih, true)} fill="var(--viz-estimate)" />
              <path class="mark" d={colPath(x0 + bw + 2, y(VALUE_MEASURED[i]), bw, (VALUE_MEASURED[i] / max) * ih, true)} fill="var(--viz-measured)" />
              {i % 2 === 1 || w > 640 ? (
                <text x={x0 + bw + 1} y={H - 8} text-anchor="middle" font-size="10.5" fill={AXIS}>
                  {wk}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={w} />
    </div>
  );
}

// ── Cost per intent by kind: median bar, p85 tick ──
function CostByKindChart() {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hot, setHot] = useState<number | null>(null);
  const rowH = 40;
  const bh = 18;
  const pad = { l: 118, r: 92 };
  const max = niceMax(Math.max(...COST_BY_KIND.map((c) => c.p85)));
  const iw = w - pad.l - pad.r;
  const x = (v: number) => pad.l + (v / max) * iw;
  const H = rowH * COST_BY_KIND.length + 20;
  return (
    <div ref={ref}>
      <svg width={w} height={H} role="img" aria-label="Cost per intent by criticality: median with 85th percentile marker" class={hot !== null ? "is-dim" : ""}>
        <line x1={pad.l} x2={pad.l} y1={0} y2={H - 20} stroke={GRID} />
        {[0, max / 2, max].map((t) => (
          <text key={t} x={x(t)} y={H - 4} text-anchor="middle" font-size="10.5" fill={AXIS} class="font-mono">
            ${t}
          </text>
        ))}
        {COST_BY_KIND.map((c, i) => {
          const yy = i * rowH + (rowH - bh) / 2;
          return (
            <g key={c.kind} class={hot === i ? "is-hot" : ""} tabIndex={0} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(i)} onBlur={() => setHot(null)} aria-label={`${KIND_LABEL[c.kind]}: median ${usd(c.median)}, p85 ${usd(c.p85)}, ${c.n} shipped`}>
              <rect x={0} y={i * rowH} width={w} height={rowH} fill="transparent" />
              <text x={pad.l - 10} y={yy + bh / 2 + 4} text-anchor="end" font-size="12" fill="var(--k-fg)">
                {KIND_LABEL[c.kind]}
              </text>
              <line x1={pad.l} x2={x(c.p85)} y1={yy + bh / 2} y2={yy + bh / 2} stroke={KIND_VAR[c.kind]} stroke-opacity="0.35" stroke-width="2" />
              <path class="mark" d={barPath(pad.l, yy, x(c.median) - pad.l, bh, true)} fill={KIND_VAR[c.kind]} />
              <line class="mark" x1={x(c.p85)} x2={x(c.p85)} y1={yy - 1} y2={yy + bh + 1} stroke={KIND_VAR[c.kind]} stroke-width="2" />
              <text x={x(c.p85) + 8} y={yy + bh / 2 + 4} font-size="11.5" fill={hot === i ? "var(--k-fg)" : "var(--k-muted)"} class="font-mono">
                {usd(c.median)} · n={c.n}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const OUTCOME_PARTS = [
  { key: "dismissed", label: "Dismissed as false positive", color: "var(--viz-queued)" },
  { key: "manual", label: "Handed to people", color: "var(--viz-waiting)" },
  { key: "intents", label: "Became a security intent", color: "var(--viz-security)" },
] as const;

// ── Findings by source: stacked by how investigation routed them ──
function FindingsChart() {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hot, setHot] = useState<number | null>(null);
  const rowH = 38;
  const bh = 20;
  const pad = { l: 150, r: 64 };
  const max = Math.max(...FINDINGS.map((f) => f.findings));
  const iw = w - pad.l - pad.r;
  const H = rowH * FINDINGS.length;
  const show = (i: number, yy: number) => {
    const f = FINDINGS[i];
    setHot(i);
    setTip({
      x: pad.l + (f.findings / max) * iw,
      y: yy,
      title: `${FINDING_SOURCE_LABEL[f.source]} · ${f.alerts} alerts → ${f.findings} findings`,
      rows: OUTCOME_PARTS.map((p) => ({ color: p.color, label: p.label, value: String(f[p.key]) })),
    });
  };
  const hide = () => (setHot(null), setTip(null));
  return (
    <div ref={ref} class="relative">
      <svg width={w} height={H} role="img" aria-label="Findings by source, split by how investigation routed them" class={hot !== null ? "is-dim" : ""}>
        <line x1={pad.l} x2={pad.l} y1={0} y2={H} stroke={GRID} />
        {FINDINGS.map((f, i) => {
          const yy = i * rowH + (rowH - bh) / 2;
          let acc = 0;
          return (
            <g key={f.source} class={hot === i ? "is-hot" : ""} tabIndex={0} onMouseMove={() => show(i, yy)} onMouseLeave={hide} onFocus={() => show(i, yy)} onBlur={hide}>
              <rect x={0} y={i * rowH} width={w} height={rowH} fill="transparent" />
              <text x={pad.l - 10} y={yy + bh / 2 + 4} text-anchor="end" font-size="12" fill="var(--k-fg)">
                {FINDING_SOURCE_LABEL[f.source]}
              </text>
              {OUTCOME_PARTS.map((p, j) => {
                const ww = (f[p.key] / max) * iw;
                const xx = pad.l + acc;
                acc += ww;
                const last = j === OUTCOME_PARTS.length - 1;
                return <path key={p.key} class="mark" d={barPath(xx, yy, Math.max(0, ww - (last ? 0 : 2)), bh, last)} fill={p.color} />;
              })}
              <text x={pad.l + acc + 6} y={yy + bh / 2 + 4} font-size="11.5" fill="var(--k-muted)" class="font-mono">
                {f.findings}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={w} />
    </div>
  );
}

function FindingsSection() {
  const intents = useStore((s) => s.intents);
  const examples = intents.filter((i) => i.finding).sort((a, b) => (a.phase === "done" ? 1 : 0) - (b.phase === "done" ? 1 : 0));
  const t = {
    alerts: sum(FINDINGS.map((f) => f.alerts)),
    findings: sum(FINDINGS.map((f) => f.findings)),
    dismissed: sum(FINDINGS.map((f) => f.dismissed)),
    manual: sum(FINDINGS.map((f) => f.manual)),
    intents: sum(FINDINGS.map((f) => f.intents)),
  };
  const funnel = [
    { label: "Scanner alerts", sub: "ingested by patchy", n: t.alerts },
    { label: "Findings", sub: "after accumulation and dedupe", n: t.findings },
    { label: "Investigated", sub: "by patchy's investigation agent", n: t.findings },
    { label: "Security intents", sub: "remediations, in ktiro", n: t.intents },
  ];
  return (
    <section class="k-card mt-5 overflow-hidden" aria-labelledby="findings-heading">
      <div class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Icon name="shield" size={16} class="text-ink" />
        <h2 id="findings-heading" class="k-heading !text-[14px]">
          Findings → security intents
        </h2>
        <span class="text-[12.5px] text-muted">The patchy pipeline, feeding ktiro: the last 12 weeks</span>
      </div>
      <div class="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div class="border-line p-4 lg:border-r">
          <p class="m-0 text-[13px] leading-relaxed text-muted">
            patchy ingests scanner alerts, folds repeats into one finding per repository or cloud resource, and an investigation agent triages each: a false positive is dismissed at source, work it can't fix safely goes to people, and the rest becomes a security intent here. Security intents always jump the queue.
          </p>
          <ol class="m-0 mt-4 flex list-none flex-col gap-2 p-0">
            {funnel.map((f, k) => (
              <li key={f.label} class="flex items-center gap-3">
                <span class="w-14 flex-none text-right font-mono text-[15px] font-bold">{f.n}</span>
                <span class="relative h-2 flex-1 overflow-hidden rounded-full bg-line">
                  <span
                    class="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${Math.max(2, (f.n / t.alerts) * 100)}%`, background: k === funnel.length - 1 ? "var(--viz-security)" : "var(--viz-working)" }}
                  />
                </span>
                <span class="w-[46%] flex-none text-[12.5px]">
                  <span class="font-semibold">{f.label}</span> <span class="text-faint">{f.sub}</span>
                </span>
              </li>
            ))}
          </ol>
          <dl class="k-kv mt-5 border-t border-line pt-4">
            <div>
              <dt>Finding to done</dt>
              <dd class="font-mono font-bold">{FINDING_MTTR_DAYS}d</dd>
              <dd class="!mt-0 text-[11.5px] text-faint">median · features take {FEATURE_LEAD_DAYS}d</dd>
            </div>
            <div>
              <dt>Cost per remediated finding</dt>
              <dd class="font-mono font-bold">{usd(FINDING_COST.investigation + FINDING_COST.intent)}</dd>
              <dd class="!mt-0 text-[11.5px] text-faint">
                {usd(FINDING_COST.investigation)} investigation + {usd(FINDING_COST.intent)} intent
              </dd>
            </div>
            <div>
              <dt>Dismissed at source</dt>
              <dd class="font-mono font-bold">{Math.round((t.dismissed / t.findings) * 100)}%</dd>
              <dd class="!mt-0 text-[11.5px] text-faint">verdict written back to the scanner</dd>
            </div>
          </dl>
        </div>
        <div class="p-4">
          <Legend items={OUTCOME_PARTS.map((p) => ({ label: p.label, color: p.color }))} />
          <div class="mt-3">
            <FindingsChart />
          </div>
          <details class="mt-2 text-[12.5px]">
            <summary class="cursor-pointer text-muted hover:text-fg">Show as table</summary>
            <div class="mt-2 overflow-x-auto rounded-lg border border-line">
              <table class="k-table !text-[12.5px]">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th class="num">Alerts</th>
                    <th class="num">Findings</th>
                    <th class="num">Dismissed</th>
                    <th class="num">To people</th>
                    <th class="num">Intents</th>
                  </tr>
                </thead>
                <tbody>
                  {FINDINGS.map((f) => (
                    <tr key={f.source}>
                      <td>{FINDING_SOURCE_LABEL[f.source]}</td>
                      <td class="num">{f.alerts}</td>
                      <td class="num">{f.findings}</td>
                      <td class="num">{f.dismissed}</td>
                      <td class="num">{f.manual}</td>
                      <td class="num">{f.intents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <div class="mt-4 border-t border-line pt-3">
            <div class="k-label">Security intents raised from findings</div>
            <ul class="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
              {examples.map((i) => (
                <li key={i.id}>
                  <a href={hrefIntent(i.id)} class="flex items-center gap-2 text-[12.5px] text-fg no-underline hover:text-ink">
                    <KindPill kind={i.kind} compact />
                    <span class="font-mono text-[11.5px] text-faint">{i.id}</span>
                    <span class="min-w-0 flex-1 truncate">{i.title}</span>
                    <span class="k-mono-tag hidden !text-[10.5px] sm:inline-flex">{i.finding!.id}</span>
                    <span class={`text-[11.5px] ${i.phase === "done" ? "text-done" : "text-muted"}`}>{PHASE_LABEL[i.phase]}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function MatrixSection() {
  const intents = useStore((s) => s.intents);
  return (
    <section class="k-card mt-5 overflow-hidden" aria-labelledby="matrix-now">
      <div class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Icon name="columns" size={15} class="text-ink" />
        <h2 id="matrix-now" class="k-heading !text-[14px]">
          Intents by phase and criticality, now
        </h2>
        <span class="text-[12.5px] text-muted">Live from the factory; the same view sits on the backlog</span>
      </div>
      <PhaseKindMatrix intents={intents} compact />
    </section>
  );
}

// ───────────────────────────── view ─────────────────────────────

export function InsightsView() {
  const shipped = sum(KINDS.map((k) => sum(THROUGHPUT[k])));
  const prevShipped = sum(KINDS.map((k) => sum(THROUGHPUT[k].slice(0, 6))));
  const lastShipped = shipped - prevShipped;
  const lead = { queued: sum(LEAD_TIME.map((r) => r.queued)), working: sum(LEAD_TIME.map((r) => r.working)), waiting: sum(LEAD_TIME.map((r) => r.waiting)) };
  const leadTotal = lead.queued + lead.working + lead.waiting;
  const waitShare = lead.waiting / leadTotal;
  const cost = sum(COST_BY_PHASE.map((c) => c.usd));
  const measured = sum(VALUE_MEASURED);
  const estimated = sum(VALUE_ESTIMATED);
  const regret = sum(REGRET) / sum(SKIPPED_GATES);
  const skipRecent = sum(AUTO_SKIP.slice(-4)) / 4;

  return (
    <div class="k-viz">
      <style>{CHART_CSS}</style>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="k-eyebrow">Insights</div>
          <h1 class="mt-1 mb-0 text-[26px] leading-tight font-bold tracking-[-0.01em]">How intents move through the factory</h1>
          <p class="mt-1.5 mb-0 max-w-[72ch] text-[14.5px] text-muted">
            The last 12 weeks. Every measure follows an intent: how long it waited, what it cost, where it needed a person. Nothing here measures individuals or teams.
          </p>
        </div>
        <span class="k-chip">
          <Icon name="calendar" size={13} /> 7 Sep – 29 Nov 2026
        </span>
      </div>

      {/* ── KPI row ── */}
      <div class="k-card mt-6 grid grid-cols-2 overflow-hidden md:grid-cols-3 xl:grid-cols-6">
        <Stat value={String(shipped)} label="Intents shipped" delta={`${lastShipped > prevShipped ? "+" : ""}${Math.round(((lastShipped - prevShipped) / prevShipped) * 100)}% vs first 6 weeks`} good={lastShipped >= prevShipped} />
        <Stat value={hours(leadTotal)} label="Median lead time" delta="excludes 72h burn-in" />
        <Stat value={usd(cost)} label="Median cost per intent" delta="model usage, all phases" />
        <Stat value={`£${measured}k`} label="ARR impact, measured" delta={`${Math.round((measured / estimated) * 100)}% of estimates`} />
        <Stat value={`${Math.round(skipRecent * 100)}%`} label="Gates skipped by agents" delta={`${(regret * 100).toFixed(1)}% later rolled back`} good={regret < 0.03} />
        <Stat value={`${CANARY.rolledBack}/${CANARY.promoted + CANARY.rolledBack}`} label="Canaries rolled back" delta="caught before full exposure" />
      </div>

      {/* ── Callout ── */}
      <div class="k-note mt-5 items-center">
        <Icon name="hand" size={16} class="flex-none" />
        <span class="min-w-0 flex-1 text-fg">
          <strong class="text-amber">Waiting on people is the largest share of lead time</strong>: {Math.round(waitShare * 100)}% ({hours(lead.waiting)} of {hours(leadTotal)}), ahead of agents working ({Math.round((lead.working / leadTotal) * 100)}%). The process agent mines every one of those interruptions for friction to remove.
        </span>
        <a href="#/agents/process" class="k-btn k-btn--sm !border-amber !text-amber no-underline">
          Process agent <Icon name="arrowRight" size={13} />
        </a>
      </div>

      {/* ── Charts ── */}
      <div class="mt-5 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Where lead time goes"
          subtitle="Median hours per phase, split by what the intent was doing"
          legend={<Legend items={LEAD_PARTS.map((p) => ({ label: LEAD_PART_LABEL[p], color: LEAD_VAR[p] }))} />}
          table={{ head: ["Phase", "Queued", "Agents working", "Waiting on people"], rows: LEAD_TIME.map((r) => [PHASE_LABEL[r.phase], hours(r.queued), hours(r.working), hours(r.waiting)]) }}
        >
          <LeadTimeChart />
        </ChartCard>

        <ChartCard
          title="Intents shipped per week"
          subtitle="Done (flag at 100% and removed from the code), by criticality"
          legend={<Legend items={KINDS.map((k) => ({ label: KIND_LABEL[k], color: KIND_VAR[k] }))} />}
          table={{ head: ["Week", ...KINDS.map((k) => KIND_LABEL[k])], rows: WEEKS.map((wk, i) => [wk, ...KINDS.map((k) => THROUGHPUT[k][i])]) }}
        >
          <ThroughputChart />
        </ChartCard>

        <ChartCard
          title="Cost per intent, by phase"
          subtitle="Median model spend through the egress broker"
          table={{ head: ["Phase", "Median cost"], rows: COST_BY_PHASE.map((c) => [PHASE_LABEL[c.phase], usd(c.usd)]) }}
        >
          <PhaseBars values={COST_BY_PHASE.map((c) => ({ phase: c.phase, v: c.usd }))} format={usd} label="Median cost per intent by phase" />
        </ChartCard>

        <ChartCard
          title="Cost per intent, by kind"
          subtitle="Model spend per intent shipped, all phases: median bar, 85th percentile tick"
          table={{ head: ["Criticality", "Median", "p85", "Shipped"], rows: COST_BY_KIND.map((c) => [KIND_LABEL[c.kind], usd(c.median), usd(c.p85), c.n]) }}
        >
          <CostByKindChart />
        </ChartCard>

        <ChartCard
          title="Where agents stop to ask"
          subtitle="Share of intents in which an agent asked a person, by phase. Gates excluded: business review's acceptance is a person by design"
          table={{ head: ["Phase", "Asked a person", "Note"], rows: HIL_RATE.map((h) => [PHASE_LABEL[h.phase], `${Math.round(h.rate * 100)}%`, h.note ?? ""]) }}
        >
          <PhaseBars values={HIL_RATE.map((h) => ({ phase: h.phase, v: h.rate, note: h.note }))} format={(v) => `${Math.round(v * 100)}%`} label="Share of intents with a HIL question, by phase" />
        </ChartCard>

        <ChartCard
          title="Gates skipped by agents"
          subtitle="Share of gates passed without a person; rings mark a skipped gate later rolled back"
          table={{ head: ["Week", "Skipped", "Gates skipped", "Rolled back"], rows: WEEKS.map((wk, i) => [wk, `${Math.round(AUTO_SKIP[i] * 100)}%`, SKIPPED_GATES[i], REGRET[i]]) }}
        >
          <AutoSkipChart />
        </ChartCard>

        <ChartCard
          wide
          title="Value shipped per week"
          subtitle="ARR impact estimated at intent vs measured against the control group"
          legend={
            <Legend
              items={[
                { label: "Estimated", color: "var(--viz-estimate)" },
                { label: "Measured", color: "var(--viz-measured)" },
              ]}
            />
          }
          table={{ head: ["Week", "Estimated", "Measured"], rows: WEEKS.map((wk, i) => [wk, `£${VALUE_ESTIMATED[i]}k`, `£${VALUE_MEASURED[i]}k`]) }}
        >
          <ValueChart />
        </ChartCard>
      </div>

      <FindingsSection />
      <MatrixSection />
    </div>
  );
}

function Stat({ value, label, delta, good }: { value: string; label: string; delta?: string; good?: boolean }) {
  return (
    <div class="k-stat border-t border-line md:border-t-0">
      <strong style={{ fontVariantNumeric: "proportional-nums" }}>{value}</strong>
      <span>{label}</span>
      {delta ? (
        <span class={`!mt-0.5 !text-[11.5px] ${good === undefined ? "!text-faint" : good ? "!text-done" : "!text-amber"}`}>{delta}</span>
      ) : null}
    </div>
  );
}
