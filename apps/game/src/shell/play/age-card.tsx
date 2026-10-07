import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { WORDS } from "../words";
import { AGES, type AgeMode } from "./ages";
import { paintingSources } from "../paintings";
import type { AgeAction } from "./age-state";
import { GoButton } from "./go-button";

type Age = (typeof AGES)[number];

/** A tile beside the home card, a band on the phone's ages, a tall card on the desktop's horizon. */
type AgeCardSize = "tile" | "band" | "tall";

const HEIGHT: Record<AgeCardSize, string> = { tile: "h-[118px]", band: "h-[168px]", tall: "h-[460px]" };

/** The image widths each size draws at, for the painting's srcset. */
const SIZES: Record<AgeCardSize, string> = { tile: "130px", band: "100vw", tall: "25vw" };

/**
 * One age (spec 04): its kit painting faded into the ground, its numeral and mode, its lore line, its live state and
 * its one action, or none. The whole card opens the age's page; Dominion is greyed.
 */
export const AgeCard = ({
  age,
  chip,
  action,
  size,
}: {
  age: Age;
  chip: ReactNode;
  action: AgeAction | null;
  size: AgeCardSize;
}) => (
  <article
    className={cn(
      "relative isolate overflow-hidden rounded-[14px] border border-kit-line",
      HEIGHT[size],
      isLocked(age.mode) && "brightness-75 grayscale",
    )}
  >
    <img
      {...paintingSources(age.painting)}
      sizes={SIZES[size]}
      alt=""
      className="absolute inset-0 -z-10 size-full object-cover"
    />
    <span className="absolute inset-0 -z-10 bg-gradient-to-b from-kit-ground/15 via-kit-ground/55 to-kit-ground/95" />
    <Link to={age.page} aria-label={age.name} className="absolute inset-0" />
    {size === "band" ? (
      <BandFace age={age} chip={chip} action={action} />
    ) : (
      <StackFace age={age} chip={chip} action={size === "tall" ? action : null} lore={size === "tall"} />
    )}
  </article>
);

const isLocked = (mode: AgeMode) => mode === "dominion";

/** "Age II" with the numeral on its own: the mode name stays the title. */
export const AgeLabel = ({ numeral }: { numeral: string }) => (
  <span className="flex items-baseline gap-1 font-ui text-[12px] font-semibold text-kit-peach">
    {WORDS.age}
    <b className="text-[20px] font-extrabold leading-none">{numeral}</b>
  </span>
);

/** A tile or a tall card: everything stacked at the foot of the painting. */
const StackFace = ({
  age,
  chip,
  action,
  lore,
}: {
  age: Age;
  chip: ReactNode;
  action: AgeAction | null;
  lore: boolean;
}) => (
  <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 flex flex-col gap-1.5">
    <AgeLabel numeral={age.numeral} />
    <h3 className="font-ui text-[15px] font-bold text-kit-cream lg:text-[19px]">{age.name}</h3>
    {lore && <p className="text-[13px] text-kit-muted">{age.lore}</p>}
    <div className="pointer-events-auto flex items-center justify-between gap-2 self-stretch">
      {chip}
      {action && <GoButton {...action} className="!h-11 !px-3 !text-[15px]" />}
    </div>
  </div>
);

/** A band: the numeral large at the left, the name, the lore line, the chip and the action at the right. */
const BandFace = ({ age, chip, action }: { age: Age; chip: ReactNode; action: AgeAction | null }) => (
  <div className="pointer-events-none absolute inset-0 flex items-end gap-3 p-3">
    <span className="pb-1 font-ui text-[44px] font-extrabold leading-none text-kit-peach">{age.numeral}</span>
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <h3 className="font-ui text-[20px] font-bold text-kit-cream">{age.name}</h3>
      <p className="text-[13px] text-kit-muted">{age.lore}</p>
      <div className="pointer-events-auto flex items-center justify-between gap-2">
        {chip}
        {action && <GoButton {...action} className="!h-12 !px-4" />}
      </div>
    </div>
  </div>
);
