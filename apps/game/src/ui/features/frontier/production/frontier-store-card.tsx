import { useGame } from "@/hooks/context/game-context";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import {
  type ExpeditionRules,
  realmLearned,
  researchRowOf,
  researchTier,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";

import { type Rank } from "@/ui/design-system/kit/words";

import { useGoToFrontierPlace } from "../frontier-home";
import { useRealmStores } from "../realm-stores";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { storeMakerLines } from "./store-makers";
import { FRONTIER_STORES, isMadeStore, type MadeStore } from "../stores";
import { StoreCard, type StoreLine } from "./store-card";

/** The stores whose ring or plate opens a card: those a building makes (Essence has no building and no limit). */
export type CardStore = MadeStore;

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
  const tick = useCurrentDefaultTick();
  const goToPlace = useGoToFrontierPlace(realm);
  const {
    resource,
    made: { category },
  } = FRONTIER_STORES[store];
  const row = researchRowOf(category);
  const learned = realmLearned(setup.store, realm.game_id, realm.entity_id);
  const manager = new ResourceManager(setup.store, safeInteger(realm.entity_id));
  const line: StoreLine = {
    kind: store,
    perHour: reading?.perHour,
    tier: learned === undefined || row === undefined ? undefined : (researchTier(learned, row) as Rank),
    held: reading?.amount,
    limit: reading?.limit,
    tone: reading?.tone ?? "calm",
    fullIn: reading?.fullIn,
    noBuilding: manager.current(resource)?.production?.building_count === 0,
    makers: storeMakerLines(setup.store, realm, resource, tick),
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
