import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { researchedDepth } from "@bibliothecadao/eternum";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { sendOnce } from "@/hooks/store/use-actions-in-flight";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import {
  configManager,
  expeditionSpireTile,
  entityMapPosition,
  getBlockTimestamp,
  isAtExpeditionSpire,
  isExpeditionRealm,
  readExpeditionRules,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import type { ID } from "@bibliothecadao/types";
import { useState } from "react";
import type { Account } from "starknet";

const DEPTH_NAMES = ["", "Ethereal I", "Ethereal II", "Ethereal III"];

/** The spire stands on the realm's own ring: an army on it or beside it picks a depth its realm has attuned to. */
export const SpireDepthActions = ({ armyEntityId }: { armyEntityId: ID }) => {
  const {
    setup: { store, systemCalls },
  } = useGame();
  const account = useAccountStore((state) => state.account);
  const [pending, setPending] = useState<number | null>(null);
  const executionSecond = useCurrentDefaultTick();
  useNativeRevision(["ArmySlot", "ExplorerTroops", "Structure", "RealmKnowledge", "TileOccupancy"]);
  const gameId = configManager.getActiveGameId();
  const explorer = store.get("ExplorerTroops", { game_id: gameId, explorer_id: armyEntityId });
  const home = explorer ? store.get("Structure", { game_id: gameId, entity_id: explorer.owner }) : undefined;
  const rules = readExpeditionRules(store, gameId);
  if (!explorer || !home || !rules || !isExpeditionRealm(store, home) || !account) return null;
  const deepest = researchedDepth(store, gameId, home.entity_id);
  if (home.owner !== BigInt(account.address) || !deepest) return null;

  const spire = expeditionSpireTile(rules, home, getBlockTimestamp().currentBlockTimestamp);
  if (!spire) return null;
  const besideSpire = isAtExpeditionSpire(spire, entityMapPosition(store, gameId, armyEntityId));
  const troops = resolveExplorerTroops(store, explorer);
  const stamina = troops ? Number(StaminaManager.getStamina(troops, executionSecond).amount) : undefined;
  // Depths are researched in order: every layer down to the deepest is open.
  const depths = Array.from({ length: deepest }, (_, index) => index + 1).map((depth) => ({
    depth,
    cost: store.require("DepthRules", { game_id: gameId, depth }).entry_stamina,
  }));

  const enter = async (depth: number) => {
    setPending(depth);
    try {
      await sendOnce("army", armyEntityId, { order: "move" }, () =>
        systemCalls.enter_depth({ signer: account as unknown as Account, explorerId: armyEntityId, depth }),
      );
    } catch (error) {
      toast.failed(error, "The army could not enter the spire.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-hud-body text-hud-ink">
        {besideSpire
          ? "Pick a depth. Deeper ground pays more and guards harder; the trip costs stamina."
          : "Bring this army to your realm's spire to enter it."}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {depths.map(({ depth, cost }) => (
          <HudButton
            key={depth}
            kind="secondary"
            size="sm"
            busy={pending === depth ? "Entering…" : undefined}
            disabled={!besideSpire || stamina === undefined || stamina < cost || pending !== null}
            title={stamina === undefined ? "Stamina —" : stamina < cost ? `Needs ${cost} stamina` : `${cost} stamina`}
            onClick={() => void enter(depth)}
          >
            {`${DEPTH_NAMES[depth]} · ${cost} stamina`}
          </HudButton>
        ))}
      </div>
    </div>
  );
};
