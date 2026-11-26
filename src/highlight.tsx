/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// Syntax highlighting for the code the prototype shows: question previews,
// agent definitions and fenced blocks in thread markdown. Same approach as
// patchy's status page: lowlight runs the highlight.js grammars and returns a
// hast tree, turned into vnodes here (or escaped HTML for the string-based
// markdown renderer), never raw innerHTML of the input. Only the grammars the
// demo uses are registered: the page is one self-contained file, so every
// grammar is paid for on every load.

import { createLowlight } from "lowlight";
import type { ComponentChildren } from "preact";
import bash from "highlight.js/lib/languages/bash";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import yaml from "highlight.js/lib/languages/yaml";

const lowlight = createLowlight({ bash, diff, go, json, markdown, sql, typescript, yaml });

// Auto-detection skips markdown: it matches nearly anything and would win on
// prose. Guesses below this relevance render plain.
const AUTO_SUBSET = lowlight.listLanguages().filter((name) => name !== "markdown");
const MIN_AUTO_RELEVANCE = 5;

type Root = ReturnType<typeof lowlight.highlight>;
type HastNode = Root["children"][number];

function tree(code: string, lang?: string): Root | null {
  const name = lang?.trim().toLowerCase();
  try {
    if (name && lowlight.registered(name)) return lowlight.highlight(name, code);
    if (name) return null;
    const auto = lowlight.highlightAuto(code, { subset: AUTO_SUBSET });
    return (auto.data?.relevance ?? 0) >= MIN_AUTO_RELEVANCE ? auto : null;
  } catch {
    // A grammar failing on odd input costs the colour, not the text.
    return null;
  }
}

function classOf(node: HastNode): string | undefined {
  if (node.type !== "element") return undefined;
  const cls = node.properties?.className;
  return Array.isArray(cls) ? cls.join(" ") : typeof cls === "string" ? cls : undefined;
}

function toVNodes(nodes: HastNode[]): ComponentChildren[] {
  return nodes.map((node, i) => {
    if (node.type === "text") return node.value;
    if (node.type !== "element") return null;
    return (
      <span key={i} class={classOf(node)}>
        {toVNodes(node.children as HastNode[])}
      </span>
    );
  });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function toHtml(nodes: HastNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return esc(node.value);
      if (node.type !== "element") return "";
      const cls = classOf(node);
      return `<span${cls ? ` class="${esc(cls)}"` : ""}>${toHtml(node.children as HastNode[])}</span>`;
    })
    .join("");
}

/** Highlighted vnodes for code in a known language, or a confident guess when lang is omitted. */
export function highlight(code: string, lang?: string): ComponentChildren {
  const t = tree(code, lang);
  return t ? toVNodes(t.children) : code;
}

/** The same, as escaped HTML, for the string-based markdown renderer. */
export function highlightHtml(code: string, lang?: string): string {
  const t = tree(code, lang);
  return t ? toHtml(t.children) : esc(code);
}
