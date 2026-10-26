import { useGame } from "@/hooks/context/game-context";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import { type ExpeditionRules, realmLearned, ResourceManager } from "@bibliothecadao/eternum";
import { safeInteger, nativeResearchConstants as research, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";

import { useGoToFrontierPlace } from "../frontier-home";
import { useRealmStores } from "../realm-stores";
import { sidesTaken } from "../research/sides-taken";
import { storeMakerLines } from "./store-makers";
import { type SpentAt, StoreCard, type StoreLine } from "./store-card";

/** The stores a card opens for: the resource each reads, its research row and where it is spent when full. */
const CARD_STORES = {
  wheat: { resource: ResourcesIds.Wheat, row: research.ROW_FARM, spentAt: "deploy" },
  labor: { resource: ResourcesIds.Labor, row: research.ROW_WORKSHOP, spentAt: "realm" },
  // One troop type: the barracks train the realm's troops.
  troops: { resource: ResourcesIds.Knight, row: research.ROW_BARRACKS, spentAt: "deploy" },
} as const satisfies Record<StoreLine["icon"], { resource: ResourcesIds; row: number; spentAt: SpentAt }>;

export type CardStore = keyof typeof CARD_STORES;

/** The stores whose ring or plate opens a card; Essence has no building and no limit, so none. */
export const CARD_STORE_KINDS = Object.keys(CARD_STORES) as CardStore[];

/**
 * One store's card over the game's facts: its rate an hour with the sides its row has taken, what it holds against its
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
  const { resource, row, spentAt } = CARD_STORES[store];
  const learned = realmLearned(setup.store, realm.game_id, realm.entity_id);
  const manager = new ResourceManager(setup.store, safeInteger(realm.entity_id));
  const line: StoreLine = {
    icon: store,
    perHour: reading?.perHour,
    sides: learned === undefined ? undefined : sidesTaken(learned, row),
    held: reading?.amount,
    limit: reading?.limit,
    tone: reading?.tone ?? "calm",
    fullIn: reading?.fullIn,
    noBuilding: manager.current(resource)?.production?.building_count === 0,
    makers: storeMakerLines(setup.store, realm, resource),
    spentAt,
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
export const isCardStore = (kind: string): kind is CardStore => (CARD_STORE_KINDS as string[]).includes(kind);
