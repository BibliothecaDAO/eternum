import { useUISound } from "@/audio/hooks/useUISound";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { knownBalance } from "@/ui/utils/utils";
import { getBalance } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";
import type { ReactNode } from "react";
import { useLandedValue, useLandingDelta } from "@/ui/motion/landing-hold";
import { EASE } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { AnimatePresence, motion } from "framer-motion";
import { bankedCounterTarget } from "@/ui/motion/moments/banked-flight";
import { TickNumber } from "@/ui/motion/tick-number";
import { DayDial } from "./day-dial";
import { formatAmount } from "./frontier-format";
import { CastleGlyph, MapGlyph } from "./glyphs";
import { troopsOnHand, useExpeditionRules, useGoToFrontierPlace } from "./frontier-home";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

// A day's Support boosts production, so the holdings move with it too.
const BALANCE_MODELS = ["RealmSupport", "ResourceBalance", "ResourceProduction"] as const;
const STRIP_RESOURCES = [ResourcesIds.Essence, ResourcesIds.Labor, ResourcesIds.Wheat] as const;

/**
 * The strip across the top of every Frontier screen (design §3.12, mockup 7), one row at every width: the day as a dial
 * whose ring drains toward midnight, what the realm holds as icons and numbers, and the map / castle toggle. The log
 * and settings sit under it as chips.
 */
export const FrontierStatusStrip = ({
  rules,
  realm,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"] | null;
}) => (
  <header
    aria-label="Expedition status"
    className={cn(
      OVERLAY_SURFACE_BASE,
      "pointer-events-auto flex items-center gap-1.5 rounded-2xl px-2 py-1.5 lg:gap-2",
    )}
  >
    <GameDayDial rules={rules} />
    {realm && <RealmHoldings realm={realm} />}
    {realm && <PlaceSwitch realm={realm} />}
  </header>
);

/** The strip's numbers: mockup 7's parchment numerals. */
const STRIP_NUMBER = "text-[15px] leading-none text-[#eadfc8] tabular-nums lg:text-base";
/** The strip's resource icons at the mockup's scale. */
const STRIP_ICON = "!size-5 lg:!size-6";

const RealmHoldings = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  useNativeRevision(BALANCE_MODELS);
  const balance = (resourceId: ResourcesIds) =>
    knownBalance(getBalance(realm.entity_id, resourceId, tick, setup.store).balance);

  return (
    <dl
      className="flex min-w-0 flex-1 items-center justify-between gap-1.5 lg:justify-start lg:gap-4"
      aria-label="Realm holdings"
    >
      {STRIP_RESOURCES.map((resourceId) => (
        <BankedHolding key={resourceId} resourceId={resourceId} amount={balance(resourceId)} />
      ))}
      <Holding
        label="Troops at home"
        icon={
          <ResourceIcon
            resource={ResourcesIds[ResourcesIds.Knight]}
            size="md"
            className={STRIP_ICON}
            withTooltip={false}
          />
        }
        value={formatAmount(troopsOnHand(setup.store, realm.entity_id, tick))}
      />
    </dl>
  );
};

const Holding = ({ label, icon, value }: { label: string; icon: ReactNode; value: string }) => (
  <div className="flex items-center gap-0.5" title={label}>
    <dt className="sr-only">{label}</dt>
    {icon}
    <dd className={STRIP_NUMBER}>{value}</dd>
  </div>
);

/**
 * A banked resource: its icon is where earned resources land, and the amount rolls to the balance fact when they do.
 */
export const BankedHolding = ({ resourceId, amount }: { resourceId: ResourcesIds; amount: number | undefined }) => {
  const target = bankedCounterTarget(resourceId);
  const shown = useLandedValue(target, amount);
  return (
    <div className="relative flex items-center gap-0.5" title={ResourcesIds[resourceId]}>
      <LandingDelta target={target} />
      <dt className="sr-only">{ResourcesIds[resourceId]}</dt>
      <span data-fly-target={target} className="inline-flex">
        <ResourceIcon resource={ResourcesIds[resourceId]} size="md" className={STRIP_ICON} withTooltip={false} />
      </span>
      <dd className={STRIP_NUMBER}>{shown === undefined ? "—" : <TickNumber value={shown} format={formatAmount} />}</dd>
    </div>
  );
};

const delta = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
/** A landing's "+N" shows this long, and never again when the counter remounts. */
const DELTA_MS = 1_400;

/** The counter's "+N" as a payout lands: its toast, popping above the number and fading as it rises. */
const LandingDelta = ({ target }: { target: string }) => {
  const landing = useLandingDelta(target);
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {landing && performance.now() - landing.at < DELTA_MS && (
        <motion.span
          key={landing.at}
          aria-live="polite"
          className="pointer-events-none absolute -top-5 right-0 whitespace-nowrap text-sm font-semibold text-gold tabular-nums"
          initial={{ opacity: 0, y: 0, scale: reduced ? 1 : 0.8 }}
          animate={{ opacity: [0, 1, 1, 0], y: reduced ? 0 : -14, scale: 1 }}
          transition={{ duration: DELTA_MS / 1000, times: [0, 0.1, 0.7, 1], ease: EASE.outQuart }}
        >
          +{delta.format(landing.amount)}
        </motion.span>
      )}
    </AnimatePresence>
  );
};

/** The day dial on the game's own block clock. */
const GameDayDial = ({ rules }: { rules: ExpeditionRules }) => <DayDial rules={rules} now={useNowSeconds()} />;

/** Frontier's two places, as glyphs: the day's expedition on the world map, and the realm board in the local view. */
const PlaceSwitch = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { isMapView } = useQuery();
  const goToPlace = useGoToFrontierPlace(realm);
  const playClick = useUISound("ui.click");

  const go = (expedition: boolean) => {
    if (expedition === isMapView) return;
    playClick();
    goToPlace(expedition);
  };

  return (
    <div role="group" aria-label="Place" className="flex shrink-0 rounded-xl border border-gold/25 bg-black/30 p-0.5">
      <PlaceButton label="Expedition" active={isMapView} onClick={() => go(true)}>
        <MapGlyph className="size-5" />
      </PlaceButton>
      <PlaceButton label="Realm" active={!isMapView} onClick={() => go(false)}>
        <CastleGlyph className="size-5" />
      </PlaceButton>
    </div>
  );
};

const PlaceButton = ({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      "flex size-9 items-center justify-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold lg:size-9",
      active ? "bg-gold/25" : "opacity-55 hover:opacity-100",
    )}
  >
    {children}
  </button>
);
