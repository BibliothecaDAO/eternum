import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useStructureUpgrade } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import { canIssueOrders } from "@/utils/can-issue-orders";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import type { PriceKind } from "@/ui/design-system/kit/price-chip";
import { knownBalance } from "@/ui/utils/utils";
import { buildablePlotCount, configManager, getBalance } from "@bibliothecadao/eternum";
import { BUILDINGS_CENTER, ResourcesIds, TroopTier } from "@bibliothecadao/types";
import { useState } from "react";

import { useGoToFrontierPlace } from "../frontier-home";
import { realmPerHour, secondsUntilHeld } from "../hud/army-order";
import { type CastleSide, CastleView } from "./castle-view";

const CASTLE_ART = ["castleZero", "castleOne", "castleTwo", "castleThree"].map(
  (name) => `/images/buildings/construction/${name}.png`,
);

/** Whether the player tapped their own realm's keep in the realm view. */
export const useKeepSelected = (realm: NativeRows["Structure"] | null): boolean => {
  const { isMapView } = useQuery();
  const selected = useUIStore((state) => state.selectedBuildingHex);
  const ordersAllowed = useUIStore(canIssueOrders);
  return (
    !isMapView &&
    ordersAllowed &&
    realm !== null &&
    selected?.structureId === realm.entity_id &&
    selected.innerCol === BUILDINGS_CENTER[0] &&
    selected.innerRow === BUILDINGS_CENTER[1]
  );
};

/** The castle's sheet over the game's facts: its level now and next, and the upgrade recipe's price. */
export const CastleUpgrade = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  const upgrade = useStructureUpgrade(realm.entity_id);
  const goToPlace = useGoToFrontierPlace(realm);
  const [sending, setSending] = useState(false);
  if (!upgrade) return null;
  const held = (resource: number) => {
    const balance = knownBalance(getBalance(realm.entity_id, resource, tick, setup.store).balance);
    return balance === undefined ? undefined : Math.floor(balance);
  };
  const short = upgrade.requirements.find(({ resource, amount }) => (held(resource) ?? 0) < amount);
  const send = async () => {
    setSending(true);
    try {
      await upgrade.handleUpgrade();
    } finally {
      setSending(false);
    }
  };
  return (
    <CastleView
      now={castleSide(upgrade.currentLevel)}
      next={upgrade.nextLevel === null ? null : castleSide(upgrade.nextLevel)}
      prices={upgrade.requirements.map(({ resource, amount }) => ({ of: castlePriceKind(resource), amount }))}
      short={
        short && {
          kind: "short",
          icon: short.resource === ResourcesIds.Essence ? "Es" : "La",
          held: held(short.resource),
          need: short.amount,
          wait: secondsUntilHeld(
            held(short.resource),
            short.amount,
            realmPerHour(setup.store, realm.entity_id, short.resource, tick),
          ),
        }
      }
      sending={sending}
      onUpgrade={() => void send()}
      onMap={() => {
        onClose();
        goToPlace(true);
      }}
      onClose={onClose}
    />
  );
};

/** The castle at a level: the plots its ring opens, its army slots and deploy cap from the preset. */
const castleSide = (level: number): CastleSide => {
  const art = CASTLE_ART[level];
  if (!art) throw new Error(`No castle art for level ${level}`);
  return {
    level,
    art,
    plots: buildablePlotCount(level),
    slots: configManager.getArmySlots(level),
    limit: undefined,
    deployCap: configManager.getMaxArmySize(level, TroopTier.T1),
  };
};

/** The castle is priced in labor (and Essence on presets that ask it); anything else is loud. */
const castlePriceKind = (resource: number): PriceKind => {
  if (resource === ResourcesIds.Labor) return "labor";
  if (resource === ResourcesIds.Essence) return "essence";
  throw new Error(`The castle is priced in resource ${resource}`);
};
