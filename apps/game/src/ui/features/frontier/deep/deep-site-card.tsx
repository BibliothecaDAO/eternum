import { GUARD_MODELS } from "@bibliothecadao/eternum/game-client";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { costLine } from "@/ui/design-system/kit/price-faces";
import { staminaShortfall } from "@/ui/design-system/kit/reasons";
import { toast } from "@/ui/features/event-feed/notify";
import { configManager, getStructureName, journeyDistance } from "@bibliothecadao/eternum";
import { deepArmyLife, readDeepSites, safeInteger, nativeRuleConstants, type DeepSiteView as Site, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { BiomeType, aspects, deepSites, formatDuration, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { isCovered, useArmyStamina, useOrderAt } from "../hud/army-order";
import { useApproachTile } from "../sites/approach";
import { readDeepSiteFight } from "../sites/site-card-plan";
import { STAMINA_MODELS } from "@bibliothecadao/eternum/troop-stamina";
import { useSelectedOwnArmy } from "../sites/selected-army";
import { DeepSiteView, type DeepBlock, type DeepGuard, type DeepOrder, type DeepTickPay } from "./deep-site-view";

const MODELS = [
  ...STAMINA_MODELS,
  ...GUARD_MODELS,
  "DeepSite",
  "ArmyRelicEffect",
  "ChestRules",
  "AltarBar",
] as const;

export function useSelectedDeepSite(): Site | null {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const now = useCurrentDefaultTick();
  useNativeRevision(MODELS);
  const selected = useUIStore((state) => state.selectedHex);
  const hexes = useMemo(() => (selected ? [selected] : []), [selected]);
  const [tile] = useWorldSpatialTiles(hexes);
  if (!isMapView || !tile) return null;
  const game_id = configManager.getActiveGameId();
  if (!setup.store.get("DeepSite", { game_id, entity_id: tile.occupierId })) return null;
  return readDeepSites(setup.store, now, game_id).find((site) => site.id === BigInt(tile.occupierId)) ?? null;
}

export function DeepSiteCard({ site, onClose }: { site: Site; onClose: () => void }) {
  const { setup, account } = useGame();
  const selected = useSelectedOwnArmy();
  const now = useCurrentDefaultTick();
  useNativeRevision(MODELS);
  const game_id = configManager.getActiveGameId();
  const userId = selected ? safeInteger(selected.army.explorer_id) : null;
  const busy = useInFlight("army", userId)?.order;
  const tile = { col: site.position.x, row: site.position.y, alt: site.position.alt };
  const adjacent =
    selected !== null &&
    selected.armyTile.alt === tile.alt &&
    journeyDistance({ x: selected.armyTile.col, y: selected.armyTile.row }, site.position) === 1;
  const block = selectionBlock(setup.store, game_id, site, selected);
  const verb =
    site.beastTroops > 0n || isRival(setup.store, game_id, site, selected)
      ? "attack"
      : site.guards.length
        ? "join"
        : "take";
  const need = verb === "join" ? 0 : configManager.getCombatConfig().stamina_attack_req;
  const stamina = useArmyStamina(userId, need);
  const approach = useOrderAt(useApproachTile(tile, !block && !adjacent));
  const act = async () => {
    if (userId === null || !account.account) return;
    try {
      await sendOnce("army", userId, { order: verb === "join" ? "use" : "attack" }, () =>
        verb === "join"
          ? setup.systemCalls.interact_site({ signer: account.account!, explorer_id: userId, coord: site.position })
          : setup.systemCalls.attack_explorer_vs_guard({
              signer: account.account!,
              explorer_id: userId,
              structure_id: safeInteger(site.id),
              relic_slot: undefined,
            }),
      );
    } catch (error) {
      toast.failed(error, "The Deep order could not be sent.");
    }
  };
  const order: DeepOrder | DeepBlock =
    block ??
    (adjacent
      ? stamina && isCovered(stamina)
        ? { kind: "act", verb, busy, onAct: act }
        : { kind: "short", verb: "attack", line: staminaShortfall(stamina?.held, need, stamina?.wait) }
      : approach
        ? {
            kind: "move",
            cost: costLine([
              { of: "stamina", amount: approach.stamina.cost },
              { of: "wheat", amount: approach.wheat.cost },
            ]),
            onMove: () => requestOrderAt(approach.target),
          }
        : "pickArmy");
  const catalog = deepSites.find((kind) => kind.id === site.kind)!;
  return (
    <DeepSiteView
      site={catalog.position}
      pay={tickPay(setup.store, game_id, site, selected)}
      guard={guardView(setup.store, game_id, site, selected, now)}
      fight={
        verb === "attack" && selected
          ? readDeepSiteFight(setup.store, site, { ...selected, biome: BiomeType.Underground, timestamp: now })
          : undefined
      }
      order={order}
      onClose={onClose}
    />
  );
}

type Selected = ReturnType<typeof useSelectedOwnArmy>;

function tickPay(store: NativeFactStore, game_id: number, site: Site, selected: Selected): DeepTickPay | null {
  const deep = store.require("DeepRules", { game_id });
  const race = store.get("RaceRules", { game_id });
  if (!race && !store.absenceKnown("RaceRules", { game_id }).known) return null;
  const banes = store.get("BaneRules", { game_id });
  if (!banes && !store.absenceKnown("BaneRules", { game_id }).known) return null;
  const quarry = site.kind === nativeRuleConstants.DEEP_QUARRY;
  const altar = site.kind === nativeRuleConstants.DEEP_ALTAR;
  const home = site.guards[0]?.army.owner ?? selected?.army.owner;
  const holder = home === undefined ? undefined : aspect(store, game_id, home);
  let bar: DeepTickPay["bar"] = null;
  if (altar && banes && holder !== undefined) {
    const reading = store.requireOrAbsent("AltarBar", { game_id, aspect: holder });
    if (!reading.known) return null;
    bar = { perTick: deep.altar_per_tick, charge: reading.known.charge, threshold: deep.altar_threshold };
  }
  return {
    glory: quarry ? 0 : Number(race?.glory_per_tick ?? 0),
    height: site.kind === nativeRuleConstants.DEEP_FOUNDATION ? (race?.height_per_tick ?? 0) : 0,
    resources: quarry ? Number(deep.quarry_per_tick) / RESOURCE_PRECISION : 0,
    bar,
  };
}

function aspect(store: NativeFactStore, game_id: number, home: bigint): number {
  return store.require("HomeAspect", { game_id, home }).aspect;
}

function isRival(store: NativeFactStore, game_id: number, site: Site, selected: Selected): boolean {
  const holder = site.guards[0];
  return (
    selected !== null &&
    holder !== undefined &&
    aspect(store, game_id, holder.army.owner) !== aspect(store, game_id, selected.army.owner)
  );
}

function selectionBlock(
  store: NativeFactStore,
  game_id: number,
  site: Site,
  selected: Selected,
): DeepBlock | undefined {
  if (!selected) return "pickArmy";
  const key = { game_id, explorer_id: selected.army.explorer_id };
  if (store.get("DeepGuard", key)) return "guarding";
  if (store.require("ArmyDay", key).day !== BigInt(site.day)) return "otherDay";
  if (selected.army.troops.count === 0n) return "noTroops";
  if (isRival(store, game_id, site, selected) || site.beastTroops > 0n) return undefined;
  const owner = store.require("Structure", { game_id, entity_id: selected.army.owner }).owner;
  if (site.guards.some(({ army }) => store.require("Structure", { game_id, entity_id: army.owner }).owner === owner))
    return "guarding";
  if (site.guards.length === nativeRuleConstants.DEEP_GUARD_SLOTS) return "full";
  return undefined;
}

function guardView(store: NativeFactStore, game_id: number, site: Site, selected: Selected, now: number): DeepGuard {
  if (site.beastTroops > 0n) return { kind: "beast", troops: Number(site.beastTroops) / RESOURCE_PRECISION };
  const next = site.guards[0];
  if (!next) return { kind: "open" };
  const total = site.guards.reduce((sum, { army }) => sum + army.troops.count, 0n);
  const holder = aspects.find((candidate) => candidate.id === aspect(store, game_id, next.army.owner));
  if (!holder) throw new Error("Unknown Deep holder Aspect");
  return {
    kind: "held",
    aspect: holder.name,
    next: safeInteger(next.army.explorer_id),
    slots: site.guards.map(({ slot, army }) => {
      const home = store.require("Structure", { game_id, entity_id: army.owner });
      const life = deepArmyLife(store, game_id, army.troops.count, now);
      return {
        slot,
        armyId: safeInteger(army.explorer_id),
        realm: getStructureName(home, store).name,
        troops: Number(army.troops.count) / RESOURCE_PRECISION,
        ticks: { left: life.ticksLeft, time: formatDuration(life.secondsLeft) },
        share: Number((army.troops.count * 100n) / total),
        mine: selected !== null && army.owner === selected.army.owner,
      };
    }),
  };
}
