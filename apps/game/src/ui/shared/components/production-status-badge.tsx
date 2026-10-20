import { type FC } from "react";

import { iconDefinition, resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudRing } from "@/ui/design-system/kit/hud-elements";
import { productionTimeLeft } from "@/ui/features/economy/resources/entity-resource-table/utils";
import { ResourcesIds } from "@bibliothecadao/types";

const PRODUCTION_DEPLETION_WINDOW_SECONDS = 10 * 60;

/**
 * The one resource ring, wherever a resource shows with its production (the holding card, the structure details, the
 * Production and Build windows): the sheet's ring, its rim in its state's tone, its arc emptying over the last ten
 * minutes of production, how many buildings make it on the top-left badge, how much is held on the foot, and while it
 * produces, the time left top right (none for a production that never runs out). Its hover names the resource only;
 * the badges say the rest, and its accessible name says it all in words (`productionReading`), so every screen that
 * draws the ring keeps the full time left and "never runs out".
 */
interface ProductionStatusBadgeProps {
  resource: ResourcesIds;
  isProducing: boolean;
  timeRemainingSeconds: number | null;
  /** How many buildings make it: the top-left badge, none at zero. */
  buildings?: number;
  /** How much is held, already formatted ("12.4K"): the foot. */
  amount?: string;
  onClick?: () => void;
  showTooltip?: boolean;
  /** Changes when the caller wants one accrual sweep around the ring; unchanged keys never replay it. */
  accrualKey?: number;
}

/**
 * A resource's production in words, the full reading the ring's rim shortens: "7h 14m of production left",
 * "production never runs out", "producing" while its time is unknown or under a minute, "not producing".
 */
const productionReading = (isProducing: boolean, secondsLeft: number | null): string => {
  if (!isProducing) return "not producing";
  if (secondsLeft === Number.POSITIVE_INFINITY) return "production never runs out";
  if (secondsLeft !== null && secondsLeft >= 60) {
    return `${productionTimeLeft(Math.ceil(secondsLeft / 60) * 60)} of production left`;
  }
  return "producing";
};

export const ProductionStatusBadge: FC<ProductionStatusBadgeProps> = ({
  resource,
  isProducing,
  timeRemainingSeconds,
  buildings = 0,
  amount,
  onClick,
  showTooltip = true,
  accrualKey,
}) => {
  const remaining = timeRemainingSeconds === null ? null : Math.max(timeRemainingSeconds, 0);
  const meaning = resourceMeaning(resource);
  const name = iconDefinition(meaning).label;
  const ring = (
    <HudRing
      icon={meaning}
      label={`${name} · ${productionReading(isProducing, remaining)}`}
      tip={showTooltip ? name : undefined}
      state={isProducing ? "producing" : "idle"}
      corner={buildings > 0 ? buildings : undefined}
      // Whole minutes only: automation refills inputs every minute, so under a minute is a topped-up resource's
      // normal state, not a warning, and shows no badge.
      timeLeft={isProducing && remaining !== null && remaining >= 60 ? Math.ceil(remaining / 60) * 60 : undefined}
      foot={amount}
      progress={
        !isProducing
          ? undefined
          : remaining === null || remaining >= PRODUCTION_DEPLETION_WINDOW_SECONDS
            ? 1
            : remaining / PRODUCTION_DEPLETION_WINDOW_SECONDS
      }
      onClick={onClick}
    />
  );
  if (accrualKey === undefined || accrualKey <= 0) return ring;
  return (
    <span className="relative inline-flex">
      {ring}
      <span key={accrualKey} aria-hidden className="pointer-events-none absolute inset-0 rounded-full accrual-sweep" />
    </span>
  );
};
