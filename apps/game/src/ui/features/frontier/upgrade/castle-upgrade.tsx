import { realmMeaning } from "@/ui/design-system/domain-icon-meaning";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { type RealmLevelUp, useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { safeInteger, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import type { PriceKind } from "@/ui/design-system/kit/price-faces";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import { knownAmount } from "@/ui/utils/utils";
import {
  buildablePlotCount,
  configManager,
  getBalance,
  realmShowsWonder,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { BUILDINGS_CENTER, RESOURCE_PRECISION, ResourcesIds, TroopTier, formatRate } from "@bibliothecadao/types";

import { realmPerHour, secondsUntilHeld } from "../hud/army-order";
import { CastleResearch, type CastleSide, type CastleUpgradeOrder, CastleView } from "./castle-view";
import { useResearchTree } from "../research/research-facts";
import { castleLabor } from "../production/store-makers";

/** Whether the keep of `realm`, the realm the board draws, is tapped in the realm view: a player's or a viewer's. */
export const useKeepSelected = (realm: NativeRows["Structure"] | null): boolean => {
  const { isMapView } = useQuery();
  const selected = useUIStore((state) => state.selectedBuildingHex);
  return (
    !isMapView &&
    realm !== null &&
    selected?.structureId === safeInteger(realm.entity_id) &&
    selected.innerCol === BUILDINGS_CENTER[0] &&
    selected.innerRow === BUILDINGS_CENTER[1]
  );
};

/**
 * The castle's sheet over the game's facts: its level and what it gives. A player's own castle adds its research and
 * Upgrade to the next level with the recipe's price; a viewer reads the castle as it stands.
 */
export const CastleUpgrade = ({
  realm,
  onResearchPage,
  onClose,
}: {
  realm: NativeRows["Structure"];
  /** Opens the Research page on one of the castle's own nodes. */
  onResearchPage: (node: string) => void;
  onClose: () => void;
}) => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  const ordersAllowed = useUIStore(canIssueOrders);
  const levelUp = useRealmLevelUp(safeInteger(realm.entity_id));
  const tree = useResearchTree(realm);
  if (!levelUp) return null;
  return (
    <CastleView
      now={castleSide(setup.store, realm.game_id, levelUp.currentLevel, realmShowsWonder(setup.store, realm))}
      laborRate={formatRate(castleLabor(setup.store, realm, tick))}
      research={
        ordersAllowed &&
        tree && (
          <CastleResearch nodes={tree.nodes.filter(({ branch }) => branch === "castle")} onOpen={onResearchPage} />
        )
      }
      upgrade={ordersAllowed && levelUp.mode !== "max" ? upgradeOrder(setup.store, realm, levelUp, tick) : undefined}
      onClose={onClose}
    />
  );
};

/** Upgrade to the next level: its side, the recipe's price, and why the realm cannot pay it yet with the wait. */
const upgradeOrder = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  levelUp: RealmLevelUp,
  tick: number,
): CastleUpgradeOrder => {
  return {
    next: castleSide(store, realm.game_id, levelUp.nextLevel, realmShowsWonder(store, realm)),
    prices: levelUp.requirements.map(({ resource, amount }) => ({ of: castlePriceKind(resource), amount })),
    refusal: castleUpgradeRefusal(store, realm, levelUp, tick),
    sending: levelUp.loading,
    onUpgrade: levelUp.run,
  };
};

export const castleUpgradeRefusal = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  levelUp: RealmLevelUp,
  tick: number,
): Refusal | undefined => {
  const realmId = safeInteger(realm.entity_id);
  const held = (resource: number) => knownAmount(getBalance(realmId, resource, tick, store, realm.game_id).balance);
  const short = levelUp.requirements.find(({ resource, amount }) => (held(resource) ?? 0) < amount);
  if (short)
    return {
      reason: {
        kind: "short",
        of: castlePriceKind(short.resource),
        held: held(short.resource),
        need: short.amount,
        wait: secondsUntilHeld(held(short.resource), short.amount, realmPerHour(store, realmId, short.resource, tick)),
      },
    };
  return levelUp.refusal ? { reason: { kind: "failed", line: `${levelUp.refusal}.` } } : undefined;
};

const castleSide = (store: NativeFactStore, gameId: number, level: number, hasWonder = false): CastleSide => {
  const art = realmMeaning(level, hasWonder);
  if (!art) throw new Error(`No castle art for level ${level}`);
  return {
    level,
    art,
    plots: buildablePlotCount(level),
    slots: configManager.getArmySlots(level),
    wheatStore: wholeOrUnknown(ResourceManager.castleStoreLimit(store, gameId, level, ResourcesIds.Wheat)),
    laborStore: wholeOrUnknown(ResourceManager.castleStoreLimit(store, gameId, level, ResourcesIds.Labor)),
    maxArmySize: configManager.getMaxArmySize(level, TroopTier.T1),
  };
};

/** The castle is priced in labor (and Essence on presets that ask it); anything else is loud. */
const castlePriceKind = (resource: number): PriceKind => {
  if (resource === ResourcesIds.Labor) return "labor";
  if (resource === ResourcesIds.Essence) return "essence";
  throw new Error(`The castle is priced in resource ${resource}`);
};

const wholeOrUnknown = (amount: bigint | undefined): number | undefined =>
  amount === undefined ? undefined : Number(amount / BigInt(RESOURCE_PRECISION));
