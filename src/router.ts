/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// Hash routing, so the single-file build works from any static host or disk.
//
//   #/                       my work
//   #/new                    define a new intent with the definer agent
//   #/intent/{id}[/{tab}]    one intent, end to end
//   #/flow                   the phase board, WIP-bounded
//   #/backlog                everything, in pull order
//   #/insights               measures of intents moving through the system
//   #/agents[/{id}]          the agents, and the process agent's proposals
//   #/knowledge[/{section}]  ADRs, repositories, the knowledge base
//   #/setup                  tenant onboarding
//   #/welcome                personal onboarding

import { useEffect, useState } from "preact/hooks";

export type IntentTab = "overview" | "conversation" | "plan" | "changes" | "technical" | "business" | "operate" | "record";
export const INTENT_TABS: IntentTab[] = ["overview", "conversation", "plan", "changes", "technical", "business", "operate", "record"];

export type Route =
  | { view: "home" }
  | { view: "new" }
  | { view: "intent"; id: string; tab: IntentTab }
  | { view: "flow" }
  | { view: "backlog" }
  | { view: "insights" }
  | { view: "agents"; id?: string }
  | { view: "knowledge"; section?: string }
  | { view: "setup" }
  | { view: "welcome" };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case "new":
      return { view: "new" };
    case "intent":
      if (parts[1]) {
        const tab = INTENT_TABS.includes(parts[2] as IntentTab) ? (parts[2] as IntentTab) : "overview";
        return { view: "intent", id: parts[1], tab };
      }
      return { view: "backlog" };
    case "flow":
      return { view: "flow" };
    case "backlog":
      return { view: "backlog" };
    case "insights":
      return { view: "insights" };
    case "agents":
      return { view: "agents", id: parts[1] };
    case "knowledge":
      return { view: "knowledge", section: parts[1] };
    case "setup":
      return { view: "setup" };
    case "welcome":
      return { view: "welcome" };
    default:
      return { view: "home" };
  }
}

export const hrefIntent = (id: string, tab?: IntentTab) =>
  `#/intent/${id}${tab && tab !== "overview" ? `/${tab}` : ""}`;

export function navigate(href: string) {
  window.location.hash = href.replace(/^#/, "");
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
