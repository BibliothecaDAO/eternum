import { useGame } from "@/hooks/context/game-context";
import { configManager, readRevealPercent, revealYield } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, type TroopTier } from "@bibliothecadao/types";

/** What each reveal sends home, in whole units; a scout's tenth of a unit reads "Under 1", never zero. */
export const formatRevealYield = (scaled: bigint | undefined): string => {
  if (scaled === undefined) return "—";
  const whole = scaled / BigInt(RESOURCE_PRECISION);
  return whole === 0n ? "Under 1 per reveal" : `${whole.toLocaleString()} per reveal`;
};

/** The muster's promise in words: what each reveal will send home, or that a scout's job is finding, not paying. */
export const describeRevealYield = (scaled: bigint | undefined): string => {
  if (scaled === undefined) return "—";
  const job = scaled < BigInt(RESOURCE_PRECISION) ? "finds sites and earns XP" : "Essence or labor";
  return `${formatRevealYield(scaled)} · ${job}`;
};

/**
 * An army's per-reveal payout at a depth, scaled, from the game's own depth rules: undefined where the depth has none,
 * null in a game whose reveals pay the drawn exploration reward instead.
 */
export const useRevealYield = (
  troops: { tier: TroopTier; count: bigint },
  depth: number,
): bigint | undefined | null => {
  const { setup } = useGame();
  if (!configManager.paysRevealSupplies()) return null;
  const percent = readRevealPercent(setup.store, configManager.getActiveGameId(), depth);
  return percent === undefined
    ? undefined
    : revealYield(troops, configManager.getTroopConfig().troop_limit_config, percent);
};

/** The muster's line under the troop count, in games that pay reveal supplies. A mustered army starts on the surface. */
export const MusterRevealYield = ({ tier, troopCount }: { tier: TroopTier; troopCount: number }) => {
  const amount = useRevealYield(
    { tier, count: BigInt(Math.max(0, Math.floor(troopCount))) * BigInt(RESOURCE_PRECISION) },
    0,
  );
  if (amount === null) return null;
  return (
    <>
      <div className="border-t border-gold/15" />
      <p className="px-1 py-1 text-[11px] text-emerald-200/90" aria-label="Payout per reveal">
        {describeRevealYield(amount)}
      </p>
    </>
  );
};
