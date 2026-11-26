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
import { DEEP_WORDS } from "@/ui/design-system/kit/words";
import { staminaShortfall } from "@/ui/design-system/kit/reasons";
import { toast } from "@/ui/features/event-feed/notify";
import { armyOaths, configManager, getStructureName, isViewerOwner, oathAttackStamina } from "@bibliothecadao/eternum";
import {
  deepAlliesGarrison,
  deepTroopsLife,
  homeAspect,
  isBesideDeepSite,
  isDeepSiteRival,
  readDeepSites,
  safeInteger,
  nativeRuleConstants,
  type DeepGarrison,
  type DeepSiteView as Site,
  type NativeFactStore,
  viewerAspects,
} from "@bibliothecadao/eternum/game-client";
import { catalogAspectId, deepSites, formatDuration, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { isCovered, useArmyStamina, useOrderAt } from "../hud/army-order";
import { useApproachTile } from "../sites/approach";
import { readDeepSiteFight } from "../sites/site-card-plan";
import { STAMINA_MODELS } from "@bibliothecadao/eternum/troop-stamina";
import { useSelectedOwnArmy } from "../sites/selected-army";
import {
  DeepSiteView,
  type DeepBlock,
  type DeepGuard,
  type DeepOpening,
  type DeepOrder,
  type DeepPay,
  type DeepRates,
} from "./deep-site-view";

const MODELS = [
  ...STAMINA_MODELS,
  ...GUARD_MODELS,
  "DeepSite",
  "DeepEntries",
  "DeepTick",
  "GarrisonSlot",
  "ArmyRelicEffect",
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
  const adjacent = selected !== null && isBesideDeepSite(selected.armyTile, site);
  const block = selectionBlock(setup.store, game_id, site, selected);
  const verb = site.beastTroops > 0n || site.garrisons.length > 0 ? "attack" : "take";
  const need =
    selected === null
      ? 0
      : oathAttackStamina(armyOaths(setup.store, selected.army), configManager.getCombatConfig().stamina_attack_req);
  const stamina = useArmyStamina(userId, need);
  const approach = useOrderAt(useApproachTile(tile, site.open && !block && !adjacent));
  const act = async () => {
    if (userId === null || !account.account) return;
    try {
      await sendOnce("army", userId, { order: "attack" }, () =>
        setup.systemCalls.attack_explorer_vs_guard({
          signer: account.account!,
          explorer_id: userId,
          structure_id: safeInteger(site.id),
          relic_slot: undefined,
        }),
      );
    } catch (error) {
      toast.failed(error, DEEP_WORDS.orderFailed);
    }
  };
  const order: DeepOrder | DeepBlock = !site.open
    ? { kind: "closed" }
    : (block ??
      (adjacent
        ? stamina && isCovered(stamina)
          ? {
              kind: "act",
              verb,
              stamina: need > 0 ? need : undefined,
              busy,
              onAct: act,
            }
          : { kind: "short", verb: "attack", line: staminaShortfall(stamina?.held, need, stamina?.wait) }
        : approach
          ? {
              kind: "move",
              prices: [
                { of: "stamina", amount: approach.stamina.cost },
                { of: "wheat", amount: approach.wheat.cost },
              ],
              onMove: () => requestOrderAt(approach.target),
            }
          : "pickArmy"));
  const catalog = deepSites.find((kind) => kind.id === site.kind)!;
  return (
    <DeepSiteView
      site={catalog.key}
      ring={site.ring}
      rates={site.open ? siteRates(setup.store, game_id, site, selected) : null}
      opening={site.open ? null : siteOpening(setup.store, game_id, site)}
      guard={guardView(setup.store, game_id, site, account.account ? BigInt(account.account.address) : null, now)}
      fight={
        verb === "attack" && selected && !block
          ? readDeepSiteFight(setup.store, site, { army: selected.army, timestamp: now })
          : undefined
      }
      order={order}
      onClose={onClose}
    />
  );
}

type Selected = ReturnType<typeof useSelectedOwnArmy>;

function siteRates(store: NativeFactStore, game_id: number, site: Site, selected: Selected): DeepRates | null {
  const deep = store.require("DeepRules", { game_id });
  const pays = sitePays(store, game_id, site);
  if (!pays) return null;
  const holder =
    site.aspect !== 0 ? site.aspect : selected ? homeAspect(store, game_id, selected.army.owner) : undefined;
  let bar: DeepRates["bar"] = null;
  if (pays.includes("bar") && holder !== undefined) {
    const reading = store.requireOrAbsent("AltarBar", { game_id, aspect: holder });
    if (!reading.known) return null;
    bar = { perTick: site.buildingPay, charge: reading.known.charge, threshold: deep.altar_threshold };
  }
  return {
    tickSeconds: Number(store.require("SliceRules", { game_id }).tick_config.armies_tick_in_seconds),
    drain: Number(deep.loss_per_tick) / RESOURCE_PRECISION,
    glory: pays.includes("glory") ? site.buildingPay : 0,
    height: pays.includes("height") ? site.buildingPay : 0,
    essence: pays.includes("essence") ? Number(deep.core_per_tick) / RESOURCE_PRECISION : 0,
    labor: pays.includes("labor") ? Number(deep.mine_per_tick) / RESOURCE_PRECISION : 0,
    bar,
  };
}

function siteOpening(store: NativeFactStore, game_id: number, site: Site): DeepOpening {
  return { entered: site.entered, realms: site.opensAt, pays: sitePays(store, game_id, site) ?? [] };
}

function sitePays(store: NativeFactStore, game_id: number, site: Site): DeepPay[] | null {
  const race = store.get("RaceRules", { game_id });
  if (!race && !store.absenceKnown("RaceRules", { game_id }).known) return null;
  const banes = store.get("BaneRules", { game_id });
  if (!banes && !store.absenceKnown("BaneRules", { game_id }).known) return null;
  const resources = site.kind === nativeRuleConstants.DEEP_CORE || site.kind === nativeRuleConstants.DEEP_MINE;
  const pays: (DeepPay | false)[] = [
    !resources && Boolean(race) && "glory",
    Boolean(race) && site.kind === nativeRuleConstants.DEEP_FOUNDATION && "height",
    site.kind === nativeRuleConstants.DEEP_CORE && "essence",
    site.kind === nativeRuleConstants.DEEP_MINE && "labor",
    Boolean(banes) && site.kind === nativeRuleConstants.DEEP_ALTAR && "bar",
  ];
  return pays.filter((pay): pay is DeepPay => pay !== false);
}

function selectionBlock(
  store: NativeFactStore,
  game_id: number,
  site: Site,
  selected: Selected,
): DeepBlock | undefined {
  if (!selected) return "pickArmy";
  const key = { game_id, explorer_id: selected.army.explorer_id };
  if (store.require("ArmyDay", key).day !== BigInt(site.day)) return "otherDay";
  if (selected.army.troops.count === 0n) return "noTroops";
  if (site.aspect !== 0 && !isDeepSiteRival(store, site, selected.army.owner, game_id))
    return deepAlliesGarrison(site.kind) || ownsSite(store, game_id, site, selected) ? "guarding" : "ownerOnly";
  return undefined;
}

function ownsSite(store: NativeFactStore, game_id: number, site: Site, selected: NonNullable<Selected>): boolean {
  const owner = store.require("Structure", { game_id, entity_id: site.id }).owner;
  return store.require("Structure", { game_id, entity_id: selected.army.owner }).owner === owner;
}

function guardView(store: NativeFactStore, game_id: number, site: Site, viewer: bigint | null, now: number): DeepGuard {
  if (site.beastTroops > 0n)
    return {
      kind: "beast",
      troops: Number(site.beastTroops) / RESOURCE_PRECISION,
      category: site.beastCategory,
    };
  if (site.aspect === 0) return { kind: "open" };
  const loss = store.require("DeepRules", { game_id }).loss_per_tick;
  const paid = ({ troops }: DeepGarrison) => (troops.count > loss ? troops.count - loss : 0n);
  const total = site.garrisons.reduce((sum, garrison) => sum + paid(garrison), 0n);
  const aspectId = catalogAspectId(site.aspect);
  const owner = store.get("Structure", { game_id, entity_id: site.id })?.owner;
  const viewerSide = isViewerOwner(owner, viewer) ? "own" : viewerAspects(store, game_id, viewer).has(aspectId) ? "ally" : "rival";
  return {
    kind: "held",
    aspectId,
    side: viewerSide,
    next: site.garrisons[0]?.slot,
    slots: site.garrisons.map((garrison) => {
      const { slot, home, troops } = garrison;
      const realm = store.require("Structure", { game_id, entity_id: home });
      const life = deepTroopsLife(store, game_id, troops.count, loss, now);
      return {
        slot,
        category: troops.category,
        tier: troops.tier,
        realm: getStructureName(realm, store).name,
        troops: Number(troops.count) / RESOURCE_PRECISION,
        lossPerTick: Number(loss) / RESOURCE_PRECISION,
        ticks: { left: life.ticksLeft, time: formatDuration(life.secondsLeft) },
        share: total === 0n ? 0 : Number((paid(garrison) * 100n) / total),
        mine: realm.owner === viewer,
      };
    }),
  };
}
