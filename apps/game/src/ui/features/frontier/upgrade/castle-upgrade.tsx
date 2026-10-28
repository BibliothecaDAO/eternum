import { realmMeaning } from "@/ui/design-system/domain-icon-meaning";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { safeInteger, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import type { PriceKind } from "@/ui/design-system/kit/price-faces";
import { knownAmount } from "@/ui/utils/utils";
import { buildablePlotCount, configManager, getBalance, ResourceManager } from "@bibliothecadao/eternum";
import { BUILDINGS_CENTER, RESOURCE_PRECISION, ResourcesIds, TroopTier, formatRate } from "@bibliothecadao/types";

import { realmPerHour, secondsUntilHeld } from "../hud/army-order";
import { CastleResearch, type CastleSide, CastleView } from "./castle-view";
import { useResearchTree } from "../research/research-facts";

/** Whether the player tapped their own realm's keep in the realm view. */
export const useKeepSelected = (realm: NativeRows["Structure"] | null): boolean => {
  const { isMapView } = useQuery();
  const selected = useUIStore((state) => state.selectedBuildingHex);
  const ordersAllowed = useUIStore(canIssueOrders);
  return (
    !isMapView &&
    ordersAllowed &&
    realm !== null &&
    selected?.structureId === safeInteger(realm.entity_id) &&
    selected.innerCol === BUILDINGS_CENTER[0] &&
    selected.innerRow === BUILDINGS_CENTER[1]
  );
};

/** The castle's sheet over the game's facts: its level now and next, and the upgrade recipe's price. */
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
  const levelUp = useRealmLevelUp(safeInteger(realm.entity_id));
  const tree = useResearchTree(realm);
  if (!levelUp) return null;
  const held = (resource: number) =>
    knownAmount(getBalance(safeInteger(realm.entity_id), resource, tick, setup.store).balance);
  const short = levelUp.requirements.find(({ resource, amount }) => (held(resource) ?? 0) < amount);
  return (
    <CastleView
      now={castleSide(setup.store, realm.game_id, levelUp.currentLevel)}
      next={levelUp.mode === "max" ? null : castleSide(setup.store, realm.game_id, levelUp.nextLevel)}
      laborRate={castleLaborRate(setup.store, realm)}
      research={
        tree && (
          <CastleResearch nodes={tree.nodes.filter(({ branch }) => branch === "castle")} onOpen={onResearchPage} />
        )
      }
      prices={levelUp.requirements.map(({ resource, amount }) => ({ of: castlePriceKind(resource), amount }))}
      refusal={
        (short && {
          reason: {
            kind: "short",
            of: castlePriceKind(short.resource),
            held: held(short.resource),
            need: short.amount,
            wait: secondsUntilHeld(
              held(short.resource),
              short.amount,
              realmPerHour(setup.store, safeInteger(realm.entity_id), short.resource, tick),
            ),
          },
        }) ||
        (levelUp.refusal ? { reason: { kind: "failed", line: `${levelUp.refusal}.` } } : undefined)
      }
      sending={levelUp.loading}
      onUpgrade={levelUp.run}
      onClose={onClose}
    />
  );
};

/**
 * The castle at a level: the plots its ring opens, its army slots, what it stores of each store (before the Granary and
 * Storeroom) and its deploy cap, from the preset.
 */
const castleSide = (store: NativeFactStore, gameId: number, level: number): CastleSide => {
  const art = realmMeaning(level);
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
