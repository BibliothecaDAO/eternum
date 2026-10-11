import { useGame } from "@/hooks/context/game-context";
import { formatExact } from "@/ui/design-system/kit/amount";
import { Chip } from "@/ui/design-system/kit/chip";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { StoreBar } from "@/ui/design-system/kit/store-bar";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { CAMP, RIFT, RUIN, STRAGGLERS, TROOPS, XP } from "@/ui/design-system/kit/words";
import { EASE } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";
import { AnimatePresence, motion } from "framer-motion";

import { siteClearXp } from "./site-card-plan";
import { RuinChestMoment } from "../chest/ruin-chest-moment";
import { closeSiteClearCard, useSiteClearCard } from "./site-clear-moment";
import type { SiteClear } from "./site-outcome";

const SITES: Record<SiteClear["kind"], { word: string; icon: IconCode }> = {
  Camp: { word: CAMP, icon: "Cp" },
  Rift: { word: RIFT, icon: "Rf" },
  Ruin: { word: RUIN, icon: "Fr" },
  Stragglers: { word: STRAGGLERS, icon: "Tr" },
};

const PAY_ICONS: Partial<Record<ResourcesIds, IconCode>> = {
  [ResourcesIds.Labor]: "La",
  [ResourcesIds.Essence]: "Es",
  [ResourcesIds.Lords]: "Lo",
};

/** A payout's resource as the card draws it; a clear paying anything else is loud. */
const payIcon = (resourceId: ResourcesIds): IconCode => {
  const icon = PAY_ICONS[resourceId];
  if (!icon) throw new Error(`A site clear paid resource ${resourceId}`);
  return icon;
};

/**
 * The clear's result over the game's facts: a ruin's chest opens with its moment (its tier and the LORDS it paid, as
 * stored when the ruin was found); every other clear slides up its card. Each shows the XP the site paid.
 */
export const SiteClearCardView = () => {
  const card = useSiteClearCard();
  const { setup } = useGame();
  const chest = card?.clear.kind === "Ruin" ? ruinChest(setup.store, card.clear.siteId) : undefined;
  const xp = card ? clearedSiteXp(setup.store, card.clear.siteId) : undefined;
  return (
    <AnimatePresence>
      {card &&
        (chest ? (
          <RuinChestMoment
            key={card.shownAt}
            tier={chest.tier}
            lords={chest.lords}
            xp={xp}
            troopsLost={card.troopsLost}
            onClose={closeSiteClearCard}
          />
        ) : (
          <SiteClearCard
            key={card.shownAt}
            site={card.clear.kind}
            paid={
              card.clear.reward && { icon: payIcon(card.clear.reward.resourceId), amount: card.clear.reward.amount }
            }
            xp={xp}
            troopsLost={card.troopsLost}
            onClose={closeSiteClearCard}
          />
        ))}
    </AnimatePresence>
  );
};

/** A cleared ruin's chest as it was stored when the ruin was found; undefined until its row is known. */
const ruinChest = (store: NativeFactStore, siteId: number): { tier: Tier; lords: number } | undefined => {
  const chest = store.get("SiteChest", { game_id: configManager.getActiveGameId(), entity_id: siteId });
  // The contract's tiers run 0 (common) to 4 (legendary); the kit counts from 1.
  return chest && { tier: (chest.tier + 1) as Tier, lords: Number(chest.amount) };
};

/** The XP the cleared site paid, from the guard it started with; unknown once its row has left the store. */
const clearedSiteXp = (store: NativeFactStore, siteId: number): number | undefined => {
  const site = store.get("ExpeditionSite", { game_id: configManager.getActiveGameId(), entity_id: siteId });
  return site && siteClearXp(site);
};

/**
 * The clear's result (wireframe 07): it slides up in the thumb zone, the site's mark with its flag, what it paid
 * large (what fitted; the full amount small beside a full bar when the store was full), its XP and the troops lost.
 * A tap goes on; it also goes by itself.
 */
export const SiteClearCard = ({
  site,
  paid,
  xp,
  troopsLost,
  onClose,
}: {
  site: SiteClear["kind"];
  /** What the clear paid home; null for a ruin, which pays its chest. */
  paid: { icon: IconCode; amount: number; full?: number } | null;
  xp: number | undefined;
  troopsLost: number;
  onClose: () => void;
}) => {
  const reduced = useReducedMotion();
  const { word, icon } = SITES[site];
  return (
    <motion.button
      type="button"
      aria-label={word}
      onClick={onClose}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={
        reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 20, transition: { duration: 0.15 } }
      }
      transition={{ duration: 0.25, ease: EASE.outQuart }}
      className="frontier-card pointer-events-auto flex h-[120px] w-full items-center gap-3 !rounded-xl !border-2 !border-kit-gold p-2.5 text-left"
    >
      <span className="relative flex size-24 shrink-0 items-center justify-center rounded-xl border border-kit-line2 bg-kit-ground">
        <KitIcon code={icon} size={52} />
        <KitIcon code="Fl" size={26} className="absolute bottom-1 right-1" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        {paid ? (
          <span className="flex items-center gap-1.5">
            <KitIcon code={paid.icon} size={30} />
            <span className="text-[36px] leading-none tabular-nums text-kit-gold2">+{formatExact(paid.amount)}</span>
          </span>
        ) : (
          <KitIcon code="Ch" size={40} />
        )}
        {paid?.full !== undefined && (
          <span className="flex w-[150px] items-center gap-1.5">
            <span className="text-[14px] tabular-nums text-kit-muted">{formatExact(paid.full)}</span>
            <StoreBar amount={1} limit={1} tone="ember" />
          </span>
        )}
        <span className="flex items-center gap-1.5">
          {xp !== undefined && <Chip icons={[]} label={XP} value={`+${formatExact(xp)}`} unit={XP} />}
          <Chip icons={["Sk"]} label={TROOPS} value={`−${formatExact(troopsLost)}`} />
        </span>
      </span>
    </motion.button>
  );
};
