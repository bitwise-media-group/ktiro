/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

import { TopBar } from "./components/TopBar";
import { Toasts } from "./components/Toasts";
import { useRoute } from "./router";
import { AgentsView } from "./views/Agents";
import { BacklogView } from "./views/Backlog";
import { FlowView } from "./views/Flow";
import { HomeView } from "./views/Home";
import { InsightsView } from "./views/Insights";
import { IntentView } from "./views/Intent";
import { KnowledgeView } from "./views/Knowledge";
import { NewIntentView } from "./views/NewIntent";
import { SetupView } from "./views/Setup";
import { WelcomeView } from "./views/Welcome";

export function App() {
  const route = useRoute();
  let view;
  switch (route.view) {
    case "home":
      view = <HomeView />;
      break;
    case "new":
      view = <NewIntentView />;
      break;
    case "intent":
      view = <IntentView id={route.id} tab={route.tab} />;
      break;
    case "flow":
      view = <FlowView />;
      break;
    case "backlog":
      view = <BacklogView />;
      break;
    case "insights":
      view = <InsightsView />;
      break;
    case "agents":
      view = <AgentsView id={route.id} />;
      break;
    case "knowledge":
      view = <KnowledgeView section={route.section} />;
      break;
    case "setup":
      view = <SetupView />;
      break;
    case "welcome":
      view = <WelcomeView />;
      break;
  }
  return (
    <>
      <a href="#main" class="k-skip">
        Skip to content
      </a>
      <TopBar route={route} />
      <main id="main" class="mx-auto max-w-[1360px] px-4 pt-6 pb-24 sm:px-6 sm:pt-8">
        {view}
      </main>
      <Toasts />
    </>
  );
}
