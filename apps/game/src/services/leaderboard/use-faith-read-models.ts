import { useFactView } from "@/hooks/use-fact-view";
import { faithFactsView } from "@/sync/fact-views";

import type { FaithReadModels } from "./faith-leaderboard-service";

/** The active game's structures, wonder faith and faithful structures, with every registered name. */
export const useFaithReadModels = (): FaithReadModels => useFactView(faithFactsView);
