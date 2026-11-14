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
import { configManager, dayOf, getStructureName, journeyDistance, readExpeditionRules } from "@bibliothecadao/eternum";
import { readDeepSites, safeInteger, nativeRuleConstants, type DeepSiteView as Site, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { aspects, deepSites, formatDuration, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { isCovered, useArmyStamina, useOrderAt } from "../hud/army-order";
import { useApproachTile } from "../sites/approach";
import { useSelectedOwnArmy } from "../sites/selected-army";
import { DeepSiteView, type DeepBlock, type DeepGuard, type DeepOrder } from "./deep-site-view";

const MODELS = ["DeepSite", "DeepGuard", "DeepArmy", "ArmyDay", "ExplorerTroops", "Guard", "TileOccupancy", "HomeAspect", "Structure"] as const;

export function useSelectedDeepSite(): Site | null {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const now = useCurrentDefaultTick();
  useNativeRevision(MODELS);
  const selected = useUIStore((state) => state.selectedHex);
  const hexes = useMemo(() => selected ? [selected] : [], [selected]);
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
  const adjacent = selected !== null && selected.armyTile.alt === tile.alt && journeyDistance(
    { x: selected.armyTile.col, y: selected.armyTile.row }, site.position,
  ) === 1;
  const block = selectionBlock(setup.store, game_id, site, selected);
  const verb = site.beastTroops > 0n || isRival(setup.store, game_id, site, selected) ? "attack" : site.guards.length ? "join" : "take";
  const need = verb === "join" ? 0 : configManager.getCombatConfig().stamina_attack_req;
  const stamina = useArmyStamina(userId, need);
  const approach = useOrderAt(useApproachTile(tile, !block && !adjacent));
  const act = async () => {
    if (userId === null || !account.account) return;
    try {
      await sendOnce("army", userId, { order: verb === "join" ? "use" : "attack" }, () => verb === "join"
        ? setup.systemCalls.interact_site({ signer: account.account!, explorer_id: userId, coord: site.position })
        : setup.systemCalls.attack_explorer_vs_guard({ signer: account.account!, explorer_id: userId, structure_id: safeInteger(site.id), relic_slot: undefined }));
    } catch (error) {
      toast.failed(error, "The Deep order could not be sent.");
    }
  };
  const order: DeepOrder | DeepBlock = block ?? (adjacent
    ? stamina && isCovered(stamina)
      ? { kind: "act", verb, busy, onAct: act }
      : { kind: "short", verb: "attack", line: staminaShortfall(stamina?.held, need, stamina?.wait) }
    : approach
      ? { kind: "move", cost: costLine([{ of: "stamina", amount: approach.stamina.cost }, { of: "wheat", amount: approach.wheat.cost }]), onMove: () => requestOrderAt(approach.target) }
      : "pickArmy");
  const catalog = deepSites.find((kind) => kind.id === site.kind)!;
  return <DeepSiteView site={catalog.position} pay={null} guard={guardView(setup.store, game_id, site, selected, now)} order={order} onClose={onClose} />;
}

type Selected = ReturnType<typeof useSelectedOwnArmy>;

function aspect(store: NativeFactStore, game_id: number, home: bigint): number {
  return store.require("HomeAspect", { game_id, home }).aspect;
}

function isRival(store: NativeFactStore, game_id: number, site: Site, selected: Selected): boolean {
  const holder = site.guards[0];
  return selected !== null && holder !== undefined && aspect(store, game_id, holder.army.owner) !== aspect(store, game_id, selected.army.owner);
}

function selectionBlock(store: NativeFactStore, game_id: number, site: Site, selected: Selected): DeepBlock | undefined {
  if (!selected) return "pickArmy";
  const key = { game_id, explorer_id: selected.army.explorer_id };
  if (store.get("DeepGuard", key)) return "guarding";
  if (store.require("ArmyDay", key).day !== BigInt(site.day)) return "otherDay";
  if (selected.army.troops.count === 0n) return "noTroops";
  if (isRival(store, game_id, site, selected) || site.beastTroops > 0n) return undefined;
  const owner = store.require("Structure", { game_id, entity_id: selected.army.owner }).owner;
  if (site.guards.some(({ army }) => store.require("Structure", { game_id, entity_id: army.owner }).owner === owner)) return "guarding";
  if (site.guards.length === nativeRuleConstants.DEEP_GUARD_SLOTS) return "full";
  return undefined;
}

function guardView(store: NativeFactStore, game_id: number, site: Site, selected: Selected, now: number): DeepGuard {
  if (site.beastTroops > 0n) return { kind: "beast", troops: Number(site.beastTroops) / RESOURCE_PRECISION };
  const next = site.guards[0];
  if (!next) return { kind: "open" };
  const rules = store.require("DeepRules", { game_id });
  const interval = Number(store.require("SliceRules", { game_id }).tick_config.armies_tick_in_seconds);
  const calendar = readExpeditionRules(store, game_id);
  if (!calendar) throw new Error("Deep guards require expedition days");
  const day = dayOf(calendar, now);
  if (!day) throw new Error("Deep site is outside its season");
  const total = site.guards.reduce((sum, { army }) => sum + army.troops.count, 0n);
  const holder = aspects.find((candidate) => candidate.id === aspect(store, game_id, next.army.owner));
  if (!holder) throw new Error("Unknown Deep holder Aspect");
  return {
    kind: "held", aspect: holder.name, next: safeInteger(next.army.explorer_id),
    slots: site.guards.map(({ slot, army }) => {
      const home = store.require("Structure", { game_id, entity_id: army.owner });
      const ticks = Number((army.troops.count + rules.loss_per_tick - 1n) / rules.loss_per_tick);
      const expires = Math.min(day.end, (Math.floor(now / interval) + ticks) * interval);
      return { slot, armyId: safeInteger(army.explorer_id), realm: getStructureName(home, store).name,
        troops: Number(army.troops.count) / RESOURCE_PRECISION,
        ticks: { left: Math.min(ticks, Math.ceil((day.end - now) / interval)), time: formatDuration(expires - now) },
        share: Number(army.troops.count * 100n / total), mine: selected !== null && army.owner === selected.army.owner };
    }),
  };
}
