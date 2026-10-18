import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { HudLoading, HudPill } from "@/ui/design-system/kit/hud-elements";

const WORLD_LOADING_ITEMS = [
  { key: LoadingStateKey.Market, label: "Gathering Merchants" },
  { key: LoadingStateKey.AllPlayerStructures, label: "Constructing Settlements" },
  { key: LoadingStateKey.Hyperstructure, label: "Awakening Ancient Powers" },
  { key: LoadingStateKey.MarketHistory, label: "Counting Gold" },
  { key: LoadingStateKey.Leaderboard, label: "Ranking Players" },
] as const;

/** What the world is still loading, said once at the screen's foot in the sheet's loading line; nothing when done. */
export const WorldLoading = () => {
  const loadingStates = useUIStore((state) => state.loadingStates);
  const loadingItems = WORLD_LOADING_ITEMS.filter(({ key }) => loadingStates[key]).map(({ label }) => label);
  if (loadingItems.length === 0) return null;
  return (
    <div id="world-loading" className="pointer-events-none fixed bottom-2 left-1/2 z-hud-loading -translate-x-1/2">
      <HudPill>{[<HudLoading key="line" line={loadingItems.join(", ")} />]}</HudPill>
    </div>
  );
};
