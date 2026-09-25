import { useUISound } from "@/audio/hooks/useUISound";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { HUD_LABEL, HUD_LABEL_BRIGHT, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { SecondaryMenuItems } from "@/ui/features/world";
import { knownBalance } from "@/ui/utils/utils";
import { expeditionDayEndsAt, seasonDay, getBalance } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";
import type { ReactNode } from "react";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { bankedCounterTarget } from "@/ui/motion/moments/reveal-yield";
import { TickNumber } from "@/ui/motion/tick-number";
import { formatAmount, formatClock } from "./frontier-format";
import { troopsOnHand, useExpeditionRules, useGoToFrontierPlace } from "./frontier-home";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

const BALANCE_MODELS = ["ResourceBalance", "ResourceProduction"] as const;
const STRIP_RESOURCES = [ResourcesIds.Essence, ResourcesIds.Labor, ResourcesIds.Wheat] as const;

/**
 * The strip across the top of every Frontier screen: today's day and how long it has left, what the realm holds,
 * the Expedition/Realm switch and settings. One row on desktop; on a phone the day and the switch take the first
 * row and the holdings with settings the second.
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
      "pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl px-3 py-2",
    )}
  >
    <ExpeditionClock rules={rules} />
    {realm && <PlaceSwitch realm={realm} />}
    <div className="order-last flex basis-full items-center gap-3 lg:order-none lg:basis-auto lg:flex-1">
      {realm && <RealmHoldings realm={realm} />}
      <div className="ml-auto">
        <SecondaryMenuItems />
      </div>
    </div>
  </header>
);

const ExpeditionClock = ({ rules }: { rules: ExpeditionRules }) => {
  const now = useNowSeconds();
  const day = seasonDay(rules, now) + 1;
  return (
    <div className="flex items-baseline gap-2" aria-label="Expedition day">
      <span className={HUD_LABEL_BRIGHT}>Day {day}</span>
      <span className={cn(HUD_VALUE, "tabular-nums")}>{formatClock(expeditionDayEndsAt(rules, now) - now)}</span>
      <span className={HUD_LABEL}>left</span>
    </div>
  );
};

const RealmHoldings = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  useNativeRevision(BALANCE_MODELS);
  const balance = (resourceId: ResourcesIds) =>
    knownBalance(getBalance(realm.entity_id, resourceId, tick, setup.store).balance);

  return (
    <dl className="flex items-center gap-3" aria-label="Realm holdings">
      {STRIP_RESOURCES.map((resourceId) => (
        <BankedHolding key={resourceId} resourceId={resourceId} amount={balance(resourceId)} />
      ))}
      <Holding
        label="Troops at home"
        icon={<ResourceIcon resource={ResourcesIds[ResourcesIds.Knight]} size="sm" withTooltip={false} />}
        value={formatAmount(troopsOnHand(setup.store, realm.entity_id, tick))}
      />
    </dl>
  );
};

const Holding = ({ label, icon, value }: { label: string; icon: ReactNode; value: string }) => (
  <div className="flex items-center gap-1" title={label}>
    <dt className="sr-only">{label}</dt>
    {icon}
    <dd className={cn(HUD_VALUE, "tabular-nums")}>{value}</dd>
  </div>
);

/**
 * A banked resource: its icon is where earned resources land, and the amount rolls to the balance fact when they do.
 */
const BankedHolding = ({ resourceId, amount }: { resourceId: ResourcesIds; amount: number | undefined }) => {
  const target = bankedCounterTarget(resourceId);
  const shown = useLandedValue(target, amount);
  return (
    <div className="flex items-center gap-1" title={ResourcesIds[resourceId]}>
      <dt className="sr-only">{ResourcesIds[resourceId]}</dt>
      <span data-fly-target={target} className="inline-flex">
        <ResourceIcon resource={ResourcesIds[resourceId]} size="sm" withTooltip={false} />
      </span>
      <dd className={cn(HUD_VALUE, "tabular-nums")}>
        {shown === undefined ? "—" : <TickNumber value={shown} format={formatAmount} />}
      </dd>
    </div>
  );
};

/** Frontier's two places: the day's expedition on the world map, and the realm board in the local view. */
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
    <div role="group" aria-label="Place" className="ml-auto flex rounded-lg border border-gold/25 p-0.5 lg:order-last">
      <PlaceButton active={isMapView} onClick={() => go(true)}>
        Expedition
      </PlaceButton>
      <PlaceButton active={!isMapView} onClick={() => go(false)}>
        Realm
      </PlaceButton>
    </div>
  );
};

const PlaceButton = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      HUD_LABEL_BRIGHT,
      "min-h-11 rounded-md px-2.5 font-sans transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold lg:min-h-8",
      active ? "bg-gold/20 text-gold" : "text-gold/60 hover:text-gold",
    )}
  >
    {children}
  </button>
);
