import {
  configManager,
  divideByPrecision,
  getBlockTimestamp,
  getEntityName,
  getExplorerOwner,
  getGuardsByStructure,
  getStructureInfoFromTileOccupier,
  getStructureName,
  presentedMineKind,
  siteKindOf,
} from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { StructureType, troopTierIndex } from "@bibliothecadao/types";

import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { accountAddress } from "@/hooks/store/use-account-store";
import { getPlayerDisplayName } from "@/services/identity/player-profiles";
import { activeMapLayer } from "@/three/map-layer";
import {
  buildArmyPlate,
  buildStructurePlate,
  guardsToTell,
  tellsGuardStamina,
  type MapPlate,
} from "@/three/map-plates/map-plate-model";
import { readPlateReward } from "@/three/map-plates/plate-reward";
import { readStandingFrontierBeast } from "@/three/structures/frontier-beast";
import { readRealmSkin } from "@/three/structures/realm-skins";
import { getBattleTimerLeft } from "@/three/utils/combat-directions";
import { isAddressEqualToAccount } from "@/three/utils/utils";
import { getGuardStaminaSnapshot } from "@/ui/features/military/utils/guard-stamina";
import { arePlayersAllied, watchedSide } from "@/utils/entity-ownership";
import { getExplorerStaminaSnapshot } from "@/utils/explorer-stamina";
import { armyHomeStructureId } from "@/utils/native-id";

import type { Hex } from "./land-from-facts";
import { normalizedHexOf } from "./map-facts";

/** A thing of the map with what its label says: today's plate, built by today's builders from the same facts. */
export interface LabelledThing {
  entityId: number;
  hex: Hex;
  plate: MapPlate;
}

/** Every army of the layer shown with its plate: its owner, its troops, its stamina now, the realm it comes from. */
export function readArmyPlates(projection: WorldSpatialProjection, store: NativeFactStore): LabelledThing[] {
  const game = configManager.getActiveGameId();
  const now = getBlockTimestamp().currentDefaultTick;
  return projection.getArmies(activeMapLayer()).flatMap((army) => {
    const explorer = store.get("ExplorerTroops", { game_id: game, explorer_id: army.entityId });
    if (!explorer || explorer.troops.count <= 0n) return [];
    const owner = getExplorerOwner(store, explorer);
    const stamina = getExplorerStaminaSnapshot({ timestamp: now, liveTroops: resolveExplorerTroops(store, explorer) });
    const home = armyHomeStructureId(explorer);
    const plate = buildArmyPlate(
      {
        entityId: army.entityId,
        ...standingOf(store, owner),
        category: army.troopCategory,
        tier: army.troopTier,
        troopCount: divideByPrecision(Number(explorer.troops.count)),
        currentStamina: stamina?.current,
        maxStamina: stamina?.max ?? 0,
        battleTimerLeft: getBattleTimerLeft(explorer.troops.battle_cooldown_end),
      },
      home === null ? "" : (getEntityName(home, store) ?? ""),
      configManager.getExploreStaminaCost(),
    );
    return [{ entityId: Number(army.entityId), hex: normalizedHexOf(army.hexCoords), plate }];
  });
}

/**
 * Every structure of the layer shown with its plate: whose it is, its name, its guard and what taking it gives. A
 * cleared site has none, as on today's map, and neither has a structure the client cannot read yet.
 */
export function readStructurePlates(projection: WorldSpatialProjection, store: NativeFactStore): LabelledThing[] {
  const game = configManager.getActiveGameId();
  const now = getBlockTimestamp().currentDefaultTick;
  return projection.getStructures(activeMapLayer()).flatMap((placed) => {
    const kind = getStructureInfoFromTileOccupier(placed.occupierType);
    if (placed.entityId === null || placed.clearedSite || !kind) return [];
    const row = store.get("Structure", { game_id: game, entity_id: placed.entityId });
    const guards = row && getGuardsByStructure(row, store);
    if (!row || !guards) return [];
    const site = store.get("ExpeditionSite", { game_id: game, entity_id: placed.entityId });
    const facts = {
      entityId: placed.entityId,
      structureName: getStructureName(row, store).name,
      structureType: kind.type,
      mineKind: presentedMineKind(row),
      level: kind.level,
      hasWonder: kind.hasWonder,
      realmSkin: kind.type === StructureType.Realm ? readRealmSkin(store, row) : undefined,
      frontierBeast: readStandingFrontierBeast(store, game, placed.entityId),
      ...standingOf(store, row.owner),
    };
    const tellsStamina = tellsGuardStamina({ siteKind: site && !site.clear ? siteKindOf(kind.type) : undefined });
    const guardArmies = guardsToTell(
      guards.map(({ slot, troops }) => {
        const stamina = tellsStamina ? getGuardStaminaSnapshot(troops, now) : null;
        return {
          slot,
          category: troops.category,
          tier: troopTierIndex(troops.tier) + 1,
          count: divideByPrecision(Number(troops.count)),
          ...(stamina ? { stamina: { ...stamina, perExplore: configManager.getExploreStaminaCost() } } : {}),
        };
      }),
      configManager.hasGuardSlots(),
    );
    const cooldownEnd = Math.max(0, ...guards.map((guard) => guard.troops.battle_cooldown_end));
    const plate = buildStructurePlate(
      { ...facts, guardArmies, incomingTroopArrivals: undefined, battleTimerLeft: getBattleTimerLeft(cooldownEnd) },
      useChainTimeStore.getState().getNowSeconds(),
      readPlateReward(store, facts),
    );
    return [{ entityId: Number(placed.entityId), hex: normalizedHexOf(placed.hexCoords), plate }];
  });
}

/** How the viewer stands to an owner, by the rules every surface reads: theirs, an ally's, or a seat's to a watcher. */
function standingOf(store: NativeFactStore, owner: bigint) {
  return {
    isMine: isAddressEqualToAccount(owner),
    isAlly: arePlayersAllied(store, accountAddress(), owner),
    owner: { address: owner, ownerName: owner === 0n ? "" : getPlayerDisplayName(owner), guildName: "" },
    watched: watchedSide(store, owner),
  };
}
