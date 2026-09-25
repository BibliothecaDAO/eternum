import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { configManager, WorldUpdateListener } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { useEffect } from "react";
import type { Account } from "starknet";
import type { Attribute } from "./attributes";
import { closePick, onAttributeChosen, openPick, shouldAutoOpenPick, usePick } from "./pick-moment";
import { PickPanel } from "./pick-panel";

const PROGRESS_MODELS = ["ArmyProgress", "ArmyProgressionRules"] as const;

/**
 * The pick in Frontier's HUD: the open offer's panel, answered with ChooseAttribute, and the player's own
 * AttributeChosen story sending the chosen card home. The session's first level-up opens the panel on its own; every
 * other offer waits on its army's chip.
 */
export const FrontierPick = () => {
  const { setup } = useGame();
  const account = useAccountStore((state) => state.account);
  const pick = usePick();
  useNativeRevision(PROGRESS_MODELS);
  useAttributeChoices();
  useFirstLevelUpOpensPick(account?.address ?? null);
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
      .choose_attribute({
        signer: account as unknown as Account,
        explorerId: pick.explorerId,
        offerId: pick.offer.id,
        attribute,
      })
      .then(() => undefined);
  return <PickPanel progress={progress} rules={rules} commit={choose} />;
};

/** Every AttributeChosen story reaches the pick, which lands only the one answering its own open offer. */
const useAttributeChoices = () => {
  const { setup } = useGame();
  useEffect(() => new WorldUpdateListener(setup).Attributes.onAttributeChosen(onAttributeChosen), [setup]);
};

/** A new Level offer on one of the player's armies, while the session plays; offers loaded with the game are not new. */
const useFirstLevelUpOpensPick = (player: string | null) => {
  const { setup } = useGame();
  useEffect(() => {
    if (!player) return;
    return setup.store.subscribe((changes) => {
      for (const change of changes) {
        if (change.model !== "ArmyProgress" || !change.previous || !change.current?.pending) continue;
        const offer = change.current.pending;
        if (change.previous.pending?.id === offer.id) continue;
        if (!isPlayersArmy(setup.store, change.current, player)) continue;
        if (shouldAutoOpenPick(offer)) openPick(change.current.explorer_id, offer);
      }
    });
  }, [player, setup.store]);
};

const isPlayersArmy = (store: NativeFactStore, army: { game_id: number; explorer_id: number }, player: string) => {
  const explorer = store.get("ExplorerTroops", army);
  const home = explorer && store.get("Structure", { game_id: army.game_id, entity_id: explorer.owner });
  return home !== undefined && BigInt(home.owner) === BigInt(player);
};
