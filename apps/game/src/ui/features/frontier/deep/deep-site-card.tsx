import { GUARD_MODELS } from "@bibliothecadao/eternum/game-client";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import type { SentCommand } from "@/sync/action-outcome";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { usePlayerNames } from "@/hooks/use-player-profile";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { DEEP_WORDS } from "@/ui/design-system/kit/words";
import { staminaShortfall } from "@/ui/design-system/kit/reasons";
import { toast } from "@/ui/features/event-feed/notify";
import {
  armyOaths,
  configManager,
  isViewerOwner,
  multiplyByPrecision,
  oathAttackStamina,
} from "@bibliothecadao/eternum";
import {
  deepAlliesGarrison,
  deepTroopsLife,
  homeAspect,
  isBesideDeepSite,
  readSyncedDeepSites,
  safeInteger,
  nativeRuleConstants,
  viewerAspects,
  type DeepGarrison,
  type DeepSiteView as Site,
  type NativeFactStore,
} from "@bibliothecadao/eternum/game-client";
import {
  catalogAspectId,
  deepSites,
  formatDuration,
  getDirectionBetweenAdjacentHexes,
  RESOURCE_PRECISION,
  type TroopTier,
} from "@bibliothecadao/types";
import { isCovered, useArmyStamina, useOrderAt } from "../hud/army-order";
import { armyStaminaCosts, troopFigures } from "../deploy/troop-figures";
import { useApproachTile } from "../sites/approach";
import { readDeepSiteFight } from "../sites/site-card-plan";
import { STAMINA_MODELS } from "@bibliothecadao/eternum/troop-stamina";
import { useSelectedOwnArmy } from "../sites/selected-army";
import { readDeepSitePays } from "./deep-site-faces";
import {
  DeepSiteView,
  type DeepBlock,
  type DeepGarrisonSlot,
  type DeepGuard,
  type DeepOpening,
  type DeepOrder,
  type DeepRates,
  type DeepSide,
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
  "RaceRules",
  "BaneRules",
  "RaceMember",
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
  return readSyncedDeepSites(setup.store, now, game_id).find((site) => site.id === BigInt(tile.occupierId)) ?? null;
}

export function DeepSiteCard({ site, onClose }: { site: Site; onClose: () => void }) {
  const { setup, account } = useGame();
  const selected = useSelectedOwnArmy();
  const address = useAccountAddress();
  const names = usePlayerNames();
  const now = useCurrentDefaultTick();
  useNativeRevision(MODELS);
  const game_id = configManager.getActiveGameId();
  const viewer: Viewer = { address, aspects: viewerAspects(setup.store, game_id, address) };
  const guard = guardView(setup.store, game_id, site, viewer, names.text, now);
  const userId = selected ? safeInteger(selected.army.explorer_id) : null;
  const busy = useInFlight("army", userId)?.order;
  const tile = { col: site.position.x, row: site.position.y, alt: site.position.alt };
  const adjacent = selected !== null && isBesideDeepSite(selected.armyTile, site);
  const guards = guard.kind === "taken" && (guard.side === "own" || guard.side === "ally");
  const need =
    guards || selected === null
      ? 0
      : oathAttackStamina(armyOaths(setup.store, selected.army), configManager.getCombatConfig().stamina_attack_req);
  const stamina = useArmyStamina(userId, need);
  const block = selectionBlock(setup.store, game_id, site, selected);
  const approach = useOrderAt(useApproachTile(tile, site.open && !block && !adjacent));
  const send = async (order: "attack" | "move", call: () => Promise<SentCommand>) => {
    if (userId === null || !account.account) return;
    try {
      await sendOnce("army", userId, { order }, call);
    } catch (error) {
      toast.failed(error, DEEP_WORDS.orderFailed);
    }
  };
  const attack = () =>
    send("attack", () =>
      setup.systemCalls.attack_explorer_vs_guard({
        signer: account.account!,
        explorer_id: userId!,
        structure_id: safeInteger(site.id),
      }),
    );
  const move: DeepOrder | undefined = approach
    ? {
        kind: "move",
        prices: [
          { of: "stamina", amount: approach.stamina.cost },
          { of: "wheat", amount: approach.wheat.cost },
        ],
        onMove: () => requestOrderAt(approach.target),
      }
    : undefined;
  const attackOrder = (): DeepOrder | DeepBlock =>
    block ??
    (adjacent
      ? stamina && isCovered(stamina)
        ? { kind: "attack", verb: defended(site) ? "attack" : "take", stamina: need || undefined, busy, onAct: attack }
        : { kind: "short", line: staminaShortfall(stamina?.held, need, stamina?.wait) }
      : (move ?? "pickArmy"));
  const guardOrder = (): DeepOrder | DeepBlock => {
    if (!mayGuard(site, viewer)) return "ownerOnly";
    if (block === "otherDay" || block === "noTroops") return block;
    if (!selected || !adjacent) return (selected && move) || "noAdjacent";
    const plan = transferPlan(setup.store, game_id, site, selected);
    if (!plan || (plan.guard <= 0 && plan.withdraw <= 0)) return "slotsFull";
    const from = { col: selected.armyTile.col, row: selected.armyTile.row };
    const at = { col: site.position.x, row: site.position.y };
    return {
      kind: "guard",
      troops: { category: selected.army.troops.category, tier: selected.army.troops.tier },
      armyTroops: Number(selected.army.troops.count) / RESOURCE_PRECISION,
      busy,
      guard:
        plan.guard > 0
          ? {
              most: plan.guard,
              onSend: (amount, targetSlot) =>
                send("move", () =>
                  setup.systemCalls.explorer_guard_swap({
                    signer: account.account!,
                    from_explorer_id: userId!,
                    to_structure_id: safeInteger(site.id),
                    to_structure_direction: getDirectionBetweenAdjacentHexes(from, at)!,
                    to_guard_slot: plan.own ? plan.slot : (targetSlot ?? plan.slot),
                    count: multiplyByPrecision(amount),
                  }),
                ),
            }
          : undefined,
      withdraw:
        plan.withdraw > 0
          ? {
              most: plan.withdraw,
              onSend: (amount) =>
                send("move", () =>
                  setup.systemCalls.guard_explorer_swap({
                    signer: account.account!,
                    from_structure_id: safeInteger(site.id),
                    from_guard_slot: plan.slot,
                    to_explorer_id: userId!,
                    to_explorer_direction: getDirectionBetweenAdjacentHexes(at, from)!,
                    count: multiplyByPrecision(amount),
                  }),
                ),
            }
          : undefined,
    };
  };
  const order: DeepOrder | DeepBlock = !site.open ? { kind: "closed" } : guards ? guardOrder() : attackOrder();
  const catalog = deepSites.find((kind) => kind.id === site.kind)!;
  return (
    <DeepSiteView
      site={catalog.key}
      ring={site.ring}
      rates={site.open ? siteRates(setup.store, game_id, site, selected) : null}
      opening={site.open ? null : siteOpening(setup.store, game_id, site)}
      guard={guard}
      fight={
        !guards && selected && defended(site)
          ? readDeepSiteFight(setup.store, site, { army: selected.army, timestamp: now })
          : undefined
      }
      figures={troopFigures(setup.store, game_id)}
      attackerStamina={selected ? armyStaminaCosts(setup.store, selected.army) : undefined}
      order={order}
      onClose={onClose}
    />
  );
}

type Selected = ReturnType<typeof useSelectedOwnArmy>;
type Viewer = { address: bigint | null; aspects: Set<number> };

const defended = (site: Site) => site.beastTroops > 0n || site.garrisons.length > 0;

function mayGuard(site: Site, viewer: Viewer): boolean {
  return deepAlliesGarrison(site.kind) || isViewerOwner(site.holder, viewer.address);
}

function slotCap(store: NativeFactStore, game_id: number, home: bigint, tier: TroopTier): number {
  return configManager.getMaxArmySize(store.require("Structure", { game_id, entity_id: home }).base.level, tier);
}

function transferPlan(
  store: NativeFactStore,
  game_id: number,
  site: Site,
  selected: NonNullable<Selected>,
): { slot: number; own: boolean; guard: number; withdraw: number } | undefined {
  const { troops, owner: home } = selected.army;
  const army = Number(troops.count) / RESOURCE_PRECISION;
  const cap = slotCap(store, game_id, home, troops.tier);
  const own = site.garrisons.find(
    (each) => each.home === home && each.troops.category === troops.category && each.troops.tier === troops.tier,
  );
  const taken = new Set(site.garrisons.map((each) => each.slot));
  const free = Array.from(
    { length: nativeRuleConstants.DEEP_GUARD_SLOTS },
    (_, index) => nativeRuleConstants.DEEP_GUARD_SLOTS - 1 - index,
  ).find((slot) => !taken.has(slot));
  const slot = own?.slot ?? free;
  if (slot === undefined) return undefined;
  const held = own ? Number(own.troops.count) / RESOURCE_PRECISION : 0;
  return {
    slot,
    own: own !== undefined,
    guard: Math.min(army, Math.max(0, cap - held)),
    withdraw: Math.min(held, Math.max(0, cap - army)),
  };
}

function siteRates(store: NativeFactStore, game_id: number, site: Site, selected: Selected): DeepRates | null {
  const deep = store.require("DeepRules", { game_id });
  const pays = readDeepSitePays(store, game_id, site.kind);
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
  return { entered: site.entered, realms: site.opensAt, pays: readDeepSitePays(store, game_id, site.kind) ?? [] };
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
  return undefined;
}

function guardView(
  store: NativeFactStore,
  game_id: number,
  site: Site,
  viewer: Viewer,
  nameOf: (address: bigint) => string,
  now: number,
): DeepGuard {
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
  const slot = (garrison: DeepGarrison): DeepGarrisonSlot => {
    const homeOwner = store.require("Structure", { game_id, entity_id: garrison.home }).owner;
    const aspect = homeAspect(store, game_id, garrison.home);
    return {
      slot: garrison.slot,
      owner: nameOf(homeOwner),
      aspectId: catalogAspectId(aspect),
      side: sideFor(homeOwner, aspect, viewer),
      troops: { category: garrison.troops.category, tier: garrison.troops.tier },
      count: Number(garrison.troops.count) / RESOURCE_PRECISION,
      cap: slotCap(store, game_id, garrison.home, garrison.troops.tier),
      share: total === 0n ? 0 : Number((paid(garrison) * 100n) / total),
      timeLeft: formatDuration(deepTroopsLife(store, game_id, garrison.troops.count, loss, now).secondsLeft),
    };
  };
  const slots = site.garrisons.map(slot);
  const owner = site.holder;
  const mine = site.garrisons.find((_, index) => slots[index]!.side === "own");
  const side = mine ? "own" : sideFor(owner, site.aspect, viewer);
  const gloryHome =
    mine?.home ??
    (side === "own" || side === "ally" ? viewerHomeInAspect(store, game_id, viewer.address, site.aspect) : undefined);
  return {
    kind: "taken",
    owner: nameOf(owner),
    aspectId: catalogAspectId(site.aspect),
    side,
    slots,
    mayAdd: mayGuard(site, viewer),
    alliesMayGuard: deepAlliesGarrison(site.kind),
    gloryWon: gloryHome === undefined ? undefined : confirmedGlory(store, game_id, gloryHome, mine !== undefined),
  };
}

function sideFor(owner: bigint, aspect: number, viewer: Viewer): DeepSide {
  if (isViewerOwner(owner, viewer.address)) return "own";
  if (viewer.aspects.has(aspect)) return "ally";
  return viewer.aspects.size > 0 ? "rival" : "held";
}

function viewerHomeInAspect(
  store: NativeFactStore,
  game_id: number,
  address: bigint | null,
  aspect: number,
): bigint | undefined {
  if (address === null) return undefined;
  return [...store.structuresOwnedBy(game_id, address)].find(
    (structure) => store.get("HomeAspect", { game_id, home: structure.entity_id })?.aspect === aspect,
  )?.entity_id;
}

function confirmedGlory(
  store: NativeFactStore,
  game_id: number,
  home: bigint,
  includeZero: boolean,
): number | undefined {
  const member = store.requireOrAbsent("RaceMember", { game_id, entity_id: home });
  if (!member.known) return undefined;
  if (!includeZero && member.known.glory === 0n) return undefined;
  return Number(member.known.glory) / RESOURCE_PRECISION;
}
