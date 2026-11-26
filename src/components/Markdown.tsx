/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// A deliberately tiny markdown renderer for the demo's own strings:
// paragraphs, "- " lists, fenced code, **bold**, *italic*, `code`. The input
// is always authored in src/data or typed into the demo, and is escaped first.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function renderMarkdown(src: string): string {
  const out: string[] = [];
  const blocks = src.split(/\n{2,}/);
  for (const block of blocks) {
    if (block.startsWith("```")) {
      out.push(`<pre><code>${esc(block.replace(/^```\w*\n?/, "").replace(/```$/, ""))}</code></pre>`);
    } else if (/^\s*[-*] /.test(block)) {
      const items = block.split(/\n(?=\s*[-*] )/).map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ""))}</li>`);
      out.push(`<ul>${items.join("")}</ul>`);
    } else if (/^#{1,3} /.test(block)) {
      const level = block.match(/^#+/)![0].length;
      out.push(`<h${level}>${inline(block.replace(/^#+ /, ""))}</h${level}>`);
    } else {
      out.push(`<p>${inline(block).replace(/\n/g, "<br/>")}</p>`);
    }
  }
  return out.join("");
}

export function Markdown({ src, class: klass = "" }: { src: string; class?: string }) {
  return <div class={`k-md ${klass}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(src) }} />;
}
