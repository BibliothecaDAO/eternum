import { configManager } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { useFactView } from "@/hooks/use-fact-view";
import { type FactView, playerScopeApplied } from "@/sync/fact-views";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";

/** What the HUD tells a player whose last realm has fallen. */
export const OUT_OF_GAME = "You hold no realm.";

/**
 * Whether the signed-in player is out of this game: they entered it, and hold no realm now, whatever else they still
 * hold. Never before their own facts are known, and never for a spectator, who has no viewer.
 */
export const outOfGameView: FactView<boolean> = {
  models: ["PlayerEntry", "Structure"],
  read: (store, viewer) => {
    if (viewer === null || !playerScopeApplied(store, viewer)) return false;
    const gameId = configManager.getActiveGameId();
    if (!store.get("PlayerEntry", { game_id: gameId, owner: viewer })) return false;
    return ![...store.structuresOwnedBy(gameId, viewer)].some(
      (structure) => structure.base.category === StructureType.Realm,
    );
  },
};

/** The HUD's line for a player out of the game, over their holdings and over the standings they then watch. */
export const OutOfGameLine = () =>
  useFactView(outOfGameView) ? (
    <HudPanel label="Out of the game" collapsible={false}>
      <p>{OUT_OF_GAME}</p>
    </HudPanel>
  ) : null;
