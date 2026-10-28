import { readRealmSkin, type RealmSkin } from "@/three/structures/realm-skins";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { realmMeaning } from "@/ui/design-system/domain-icon-meaning";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { type RealmLevelUp, useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { safeInteger, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import type { PriceKind } from "@/ui/design-system/kit/price-faces";
import { knownAmount } from "@/ui/utils/utils";
import { buildablePlotCount, configManager, getBalance, ResourceManager } from "@bibliothecadao/eternum";
import { BUILDINGS_CENTER, RESOURCE_PRECISION, ResourcesIds, TroopTier, formatRate } from "@bibliothecadao/types";

import { realmPerHour, secondsUntilHeld } from "../hud/army-order";
import { CastleResearch, type CastleSide, type CastleUpgradeOrder, CastleView } from "./castle-view";
import { useResearchTree } from "../research/research-facts";

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
  useNativeRevision(["CampaignHome"]);
  const skin = readRealmSkin(setup.store, realm);
  const ordersAllowed = useUIStore(canIssueOrders);
  const levelUp = useRealmLevelUp(safeInteger(realm.entity_id));
  const tree = useResearchTree(realm);
  if (!levelUp) return null;
  return (
    <CastleView
      now={castleSide(setup.store, realm.game_id, levelUp.currentLevel, skin)}
      laborRate={castleLaborRate(setup.store, realm)}
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
  const realmId = safeInteger(realm.entity_id);
  const held = (resource: number) => knownAmount(getBalance(realmId, resource, tick, store).balance);
  const short = levelUp.requirements.find(({ resource, amount }) => (held(resource) ?? 0) < amount);
  return {
    next: castleSide(store, realm.game_id, levelUp.nextLevel, readRealmSkin(store, realm)),
    prices: levelUp.requirements.map(({ resource, amount }) => ({ of: castlePriceKind(resource), amount })),
    refusal:
      (short && {
        reason: {
          kind: "short",
          of: castlePriceKind(short.resource),
          held: held(short.resource),
          need: short.amount,
          wait: secondsUntilHeld(
            held(short.resource),
            short.amount,
            realmPerHour(store, realmId, short.resource, tick),
          ),
        },
      }) ||
      (levelUp.refusal ? { reason: { kind: "failed", line: `${levelUp.refusal}.` } } : undefined),
    sending: levelUp.loading,
    onUpgrade: levelUp.run,
  };
};

/**
 * The castle at a level: the plots its ring opens, its army slots, what it stores of each store (before the Granary and
 * Storeroom) and its deploy cap, from the preset.
 */
const castleSide = (store: NativeFactStore, gameId: number, level: number, skin?: RealmSkin): CastleSide => {
  const art = realmMeaning(level, skin);
  if (!art) throw new Error(`No castle art for level ${level}`);
  return {
    level,
    art,
    plots: buildablePlotCount(level),
    slots: configManager.getArmySlots(level),
    limit: wholeOrUnknown(ResourceManager.castleStoreLimit(store, gameId, level)),
    maxArmySize: configManager.getMaxArmySize(level, TroopTier.T1),
  };
};

/**
 * The labor the castle itself makes a minute: a realm is provisioned with its own labor producer at the labor rule's
 * realm rate (the contract's provision_realm_economy), apart from any Workshop on the board.
 */
const castleLaborRate = (store: NativeFactStore, realm: NativeRows["Structure"]): string => {
  const perSecond = store.require("ResourceRule", {
    game_id: realm.game_id,
    resource_type: ResourcesIds.Labor,
  }).realm_rate;
  return formatRate(Number(perSecond) / RESOURCE_PRECISION);
};

/** The castle is priced in labor (and Essence on presets that ask it); anything else is loud. */
const castlePriceKind = (resource: number): PriceKind => {
  if (resource === ResourcesIds.Labor) return "labor";
  if (resource === ResourcesIds.Essence) return "essence";
  throw new Error(`The castle is priced in resource ${resource}`);
};

const wholeOrUnknown = (amount: bigint | undefined): number | undefined =>
  amount === undefined ? undefined : Number(amount / BigInt(RESOURCE_PRECISION));
