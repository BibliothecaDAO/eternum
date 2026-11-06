import { useGame } from "@/hooks/context/game-context";
import type { Rank } from "@/ui/design-system/kit/words";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import { type ExpeditionRules, realmLearned, researchTier, ResourceManager } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";

import { useGoToFrontierPlace } from "../frontier-home";
import { useRealmStores } from "../realm-stores";
import { storeMakerLines } from "./store-makers";
import { FRONTIER_STORES, isMadeStore, MADE_STORES, type MadeStore } from "../stores";
import { StoreCard, type StoreLine } from "./store-card";

/** The stores whose ring or plate opens a card: those a building makes (Essence has no building and no limit). */
export type CardStore = MadeStore;
export const CARD_STORE_KINDS = MADE_STORES;

/**
 * One store's card over the game's facts: its rate an hour with its row's research tier, what it holds against its
 * limit, when it is full, and whether a building makes it. Spending or building closes it on the way there.
 */
export const FrontierStoreCard = ({
  rules,
  realm,
  store,
  onDone,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  store: CardStore;
  onDone: () => void;
}) => {
  const { setup } = useGame();
  const reading = useRealmStores(realm, rules)?.[store];
  const goToPlace = useGoToFrontierPlace(realm);
  const {
    resource,
    made: { row },
  } = FRONTIER_STORES[store];
  const learned = realmLearned(setup.store, realm.game_id, realm.entity_id);
  const manager = new ResourceManager(setup.store, safeInteger(realm.entity_id));
  const line: StoreLine = {
    kind: store,
    perHour: reading?.perHour,
    rank: learned === undefined ? undefined : (researchTier(learned, row) as Rank),
    held: reading?.amount,
    limit: reading?.limit,
    tone: reading?.tone ?? "calm",
    fullIn: reading?.fullIn,
    noBuilding: manager.current(resource)?.production?.building_count === 0,
    makers: storeMakerLines(setup.store, realm, resource),
  };
  return (
    <StoreCard
      line={line}
      onSpend={(at) => {
        onDone();
        if (at === "realm") goToPlace(false);
        else openArmyDeployment({ structureId: safeInteger(realm.entity_id), isExplorer: true });
      }}
      onBuild={() => {
        onDone();
        goToPlace(false);
      }}
    />
  );
};

/** Whether a store's ring or plate opens a card. */
export const isCardStore = isMadeStore;
