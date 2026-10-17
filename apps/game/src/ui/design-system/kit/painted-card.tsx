import type { ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { paintingSources, type Painting } from "./paintings";

/**
 * The dark grade over the painting, by where the card's words stand: along its left (a game, a post's cover), or from
 * its top (a step, a player's banner). None where nothing stands on it (a card's header strip).
 */
const GRADES = {
  side: "bg-gradient-to-r from-kit-ground/95 via-kit-ground/80 to-kit-ground/40",
  cover: "bg-gradient-to-r from-kit-ground/95 via-kit-ground/75 to-kit-ground/30",
  top: "bg-gradient-to-b from-kit-ground/85 to-transparent",
  "top-deep": "bg-gradient-to-b from-kit-ground/90 to-transparent",
  none: null,
} as const;

/**
 * A card on a painting: the painting fills it behind its words, under the grade that keeps them readable, inside the
 * painted keyline (index.css `.painted`).
 */
export const PaintedCard = ({
  painting,
  sizes,
  grade,
  as: Element = "section",
  className,
  children,
  ...data
}: {
  painting: Painting;
  /** The painting's displayed width for the browser's pick from its sizes, as the page lays the card out. */
  sizes: string;
  grade: keyof typeof GRADES;
  as?: "section" | "header" | "span";
  className?: string;
  children?: ReactNode;
  /** A hook the page and its proofs name the card by (`data-play-item`). */
  [hook: `data-${string}`]: string | undefined;
}) => (
  <Element className={cn("painted rounded-plate", className)} {...data}>
    <img
      {...paintingSources(painting)}
      sizes={sizes}
      alt=""
      className="absolute inset-0 -z-10 size-full object-cover"
    />
    {GRADES[grade] && <span className={cn("absolute inset-0 -z-10", GRADES[grade])} />}
    {children}
  </Element>
);
