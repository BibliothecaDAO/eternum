import {
  armyStrength,
  configManager,
  type GameActions,
  getBalance,
  getTroopResourceId,
  openSpawnDirections,
  readRevealPercent,
  revealYield,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { musterStamina, type OpenArmySlot, openArmySlots } from "@bibliothecadao/eternum/troop-stamina";
import { type Direction, RESOURCE_PRECISION, TroopTier, TroopType } from "@bibliothecadao/types";

/**
 * What Frontier's muster needs, read from facts with no UI of its own: the realm's next open slot and the troop stacks
 * it holds, then for a chosen stack and count the army it would make. The sheet's look comes from the visual redo.
 */
interface MusterStack {
  type: TroopType;
  tier: TroopTier;
  /** Whole troops waiting at the realm. */
  available: number;
  /** The most of this stack one army may take at the realm's castle level. */
  cap: number;
}

interface MusterPlan {
  /** The slot the next army fills, or null when every slot today holds an army. */
  next: OpenArmySlot | null;
  slots: { used: number; allowed: number };
  /** Only the stacks the realm holds, tier by tier. */
  stacks: MusterStack[];
}

const TYPES = [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin] as const;
const TIERS = [TroopTier.T1, TroopTier.T2, TroopTier.T3] as const;
const PRECISION = BigInt(RESOURCE_PRECISION);

/** The realm's muster today; unknown while any slot or troop balance is. */
export const readMusterPlan = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  tick: number,
): MusterPlan | undefined => {
  const allowed = realm.base.troop_max_explorer_count;
  const open = openArmySlots(store, { game_id: realm.game_id, entity_id: realm.entity_id, allowedSlots: allowed });
  if (!open) return undefined;
  const stacks: MusterStack[] = [];
  for (const tier of TIERS)
    for (const type of TYPES) {
      const balance = getBalance(realm.entity_id, getTroopResourceId(type, tier), tick, store).balance;
      if (balance === undefined) return undefined;
      const available = Number(BigInt(balance) / PRECISION);
      if (available > 0)
        stacks.push({ type, tier, available, cap: configManager.getMaxArmySize(realm.base.level, tier) });
    }
  return { next: open[0] ?? null, slots: { used: allowed - open.length, allowed }, stacks };
};

/** The most one army can take from a stack: what the realm holds, up to the castle's cap. */
export const musterMaximum = (stack: MusterStack): number => Math.min(stack.available, stack.cap);

/** The army a muster would make: its strength, what each reveal sends home and the bar it starts on. */
export const previewMuster = (
  store: NativeFactStore,
  gameId: number,
  plan: MusterPlan,
  stack: MusterStack,
  count: number,
  tick: number,
): {
  count: number;
  strength: number;
  revealYield: bigint | undefined;
  stamina: { amount: number; max: number } | null;
} => {
  const whole = Math.max(0, Math.min(Math.floor(count), musterMaximum(stack)));
  const troops = { tier: stack.tier, count: BigInt(whole) * PRECISION };
  const { troop_limit_config: limits, troop_stamina_config: staminaRules } = configManager.getTroopConfig();
  // A mustered army starts on the surface.
  const percent = readRevealPercent(store, gameId, 0);
  return {
    count: whole,
    strength: armyStrength(troops, limits),
    revealYield: percent === undefined ? undefined : revealYield(troops, limits, percent),
    stamina: plan.next
      ? musterStamina(plan.next, { category: stack.type, tier: stack.tier }, tick, staminaRules)
      : null,
  };
};

/** Where the army steps out: the first explored, open hex around the realm, or null when none is known to be. */
export const musterDirection = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  occupierAt: (hex: { col: number; row: number }) => number | undefined,
): Direction | null => openSpawnDirections(store, realm, occupierAt)[0] ?? null;

/** The Muster command: the chosen stack and count, stepping out where the realm has room. */
export const musterArmy = (
  actions: Pick<GameActions, "createExplorerArmy">,
  realm: NativeRows["Structure"],
  stack: MusterStack,
  count: number,
  direction: Direction,
): Promise<void> =>
  actions.createExplorerArmy({
    structureId: realm.entity_id,
    troopType: stack.type,
    troopTier: stack.tier,
    troopCount: count,
    spawnDirection: direction,
  });
