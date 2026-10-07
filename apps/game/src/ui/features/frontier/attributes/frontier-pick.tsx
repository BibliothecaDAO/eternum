import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { configManager, WorldUpdateListener } from "@bibliothecadao/eternum";
import { useEffect } from "react";
import type { Account } from "starknet";
import type { Attribute } from "./attributes";
import { closePick, onTierBought, usePick } from "./pick-moment";
import { PickPanel } from "./pick-panel";

const PROGRESS_MODELS = ["ArmyProgress", "ArmyProgressionRules"] as const;

/**
 * The Upgrade in Frontier's HUD: the open army's panel, answered with BuyTier, and the player's own TierBought story
 * sending the chosen card home. It opens from the army's chip.
 */
export const FrontierPick = () => {
  const { setup } = useGame();
  const account = useAccountStore((state) => state.account);
  const pick = usePick();
  useNativeRevision(PROGRESS_MODELS);
  useTierPurchases();
  const progress = pick
    ? setup.store.get("ArmyProgress", { game_id: configManager.getActiveGameId(), explorer_id: pick.explorerId })
    : undefined;
  const rules = setup.store.get("ArmyProgressionRules", { game_id: configManager.getActiveGameId() });

  // An army that leaves the store (dead, removed, midnight) takes its open pick with it.
  useEffect(() => {
    if (pick && !progress) closePick();
  }, [pick, progress]);

  if (!pick || !progress || !rules || !account) return null;
  const choose = (attribute: Attribute) =>
    setup.systemCalls
      .buy_tier({ signer: account as unknown as Account, explorerId: pick.explorerId, attribute })
      .then(() => undefined);
  return <PickPanel progress={progress} rules={rules} commit={choose} />;
};

/** Every TierBought story reaches the pick, which lands only the one for its own army's purchase. */
const useTierPurchases = () => {
  const { setup } = useGame();
  useEffect(() => new WorldUpdateListener(setup).Attributes.onTierBought(onTierBought), [setup]);
};
