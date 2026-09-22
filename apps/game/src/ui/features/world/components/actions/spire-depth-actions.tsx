import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { HUD_BODY, HUD_HEADLINE } from "@/ui/design-system/atoms/hud-typography";
import { HUD_PILL_BUTTON } from "@/ui/design-system/atoms/overlay-surface";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import {
  configManager,
  expeditionRealmSite,
  getBlockTimestamp,
  isExpeditionRealm,
  readExpeditionRules,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useGame, useNativeRevision } from "@bibliothecadao/react";
import { getNeighborHexes, type ID } from "@bibliothecadao/types";
import { useState } from "react";
import type { Account } from "starknet";

const DEPTH_NAMES = ["", "Ethereal I", "Ethereal II", "Ethereal III"];

/** The spire stands on the realm's own ring: an army beside it picks a depth its realm has attuned to. */
export const SpireDepthActions = ({ armyEntityId }: { armyEntityId: ID }) => {
  const {
    setup: { store, systemCalls },
  } = useGame();
  const account = useAccountStore((state) => state.account);
  const [pending, setPending] = useState<number | null>(null);
  useNativeRevision(["ExplorerTroops", "Structure"]);
  const gameId = configManager.getActiveGameId();
  const explorer = store.get("ExplorerTroops", { game_id: gameId, explorer_id: armyEntityId });
  const home = explorer ? store.get("Structure", { game_id: gameId, entity_id: explorer.owner }) : undefined;
  const rules = readExpeditionRules(store, gameId);
  if (!explorer || !home || !rules || !isExpeditionRealm(home) || !account) return null;
  if (home.owner !== BigInt(account.address) || home.metadata.attunement === 0) return null;

  const site = expeditionRealmSite(rules, home, useChainTimeStore.getState().getNowSeconds());
  const besideSpire = getNeighborHexes(site.col, site.row).some(
    (hex) => hex.col === explorer.coord.x && hex.row === explorer.coord.y,
  );
  const stamina = Number(StaminaManager.getStamina(explorer.troops, getBlockTimestamp().currentArmiesTick).amount);
  const depths = Array.from({ length: home.metadata.attunement }, (_, index) => index + 1).map((depth) => ({
    depth,
    cost: store.require("DepthRules", { game_id: gameId, depth }).entry_stamina,
  }));

  const enter = async (depth: number) => {
    setPending(depth);
    try {
      await systemCalls.enter_depth({ signer: account as unknown as Account, explorerId: armyEntityId, depth });
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The army could not enter the spire."));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gold/20 bg-black/25 p-2">
      <p className={HUD_HEADLINE}>The spire</p>
      <p className={HUD_BODY}>
        {besideSpire
          ? "Pick a depth. Deeper ground pays more and guards harder; the trip costs stamina."
          : "Bring this army beside your realm to enter the spire."}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {depths.map(({ depth, cost }) => (
          <button
            key={depth}
            type="button"
            className={HUD_PILL_BUTTON}
            disabled={!besideSpire || stamina < cost || pending !== null}
            title={stamina < cost ? `Needs ${cost} stamina` : `${cost} stamina`}
            onClick={() => void enter(depth)}
          >
            {pending === depth ? "Entering…" : `${DEPTH_NAMES[depth]} · ${cost} stamina`}
          </button>
        ))}
      </div>
    </div>
  );
};
