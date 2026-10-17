import type { ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

const SIZES = {
  heading: "text-heading",
  title: "text-title",
  "title-lg": "text-title-lg",
  figure: "text-figure",
} as const;

const TONES = { gold: "text-kit-gold", gold2: "text-kit-gold2", cream: "text-kit-cream" } as const;

/**
 * A number read at a glance, large: a rank, a rating, a count, a multiple. A bold figure has tabular numerals, and
 * index.css `.tabular-nums` sets every tabular figure at 700 (an extrabold class under it never shows), so a figure
 * drawn heavier, at 800, keeps proportional numerals. A size off the scale, and any leading, come in `className`.
 */
export const Figure = ({
  size,
  tone,
  weight = "bold",
  as: Element = "b",
  className,
  children,
}: {
  size?: keyof typeof SIZES;
  /** None: the figure's parts carry their own tones (a rating's before and after). */
  tone?: keyof typeof TONES;
  weight?: "bold" | "extrabold";
  as?: "b" | "span" | "p";
  className?: string;
  children: ReactNode;
}) => (
  <Element
    className={cn(
      "font-body",
      weight === "bold" ? "font-bold tabular-nums" : "font-extrabold",
      size && SIZES[size],
      tone && TONES[tone],
      className,
    )}
  >
    {children}
  </Element>
);
