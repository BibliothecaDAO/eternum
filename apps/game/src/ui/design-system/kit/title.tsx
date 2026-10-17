import type { ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

/**
 * Each level's size, its step at a wider screen and its leading. A site that sets its line apart (a hero line's own
 * leading, a figure's own size) overrides through `className`; a size given there must restate its leading, since a
 * later size drops the level's.
 */
const LEVELS = {
  /** A desktop page's title, a step up on the wide screen. */
  page: "text-title leading-tight wide:text-title-lg",
  /** A phone page's title beside Back. */
  "page-phone": "text-heading leading-tight",
  /** A plate's own display title: the sign-in panel, nothing here, a profile's name. */
  plate: "text-title leading-tight",
  /** The headline across a cover or a page: a post, the sign-in lore, a season's ending. */
  hero: "text-hero leading-[1.05]",
  /** A card's display title: Play's lead game. */
  card: "text-title leading-none lg:text-title-lg",
  /** A clock read to the second, as a lobby's countdown. */
  countdown: "text-figure leading-none",
  /** A body-face headline: a post's title on a phone, the doorway's realm. */
  headline: "text-heading",
  /** A phone page's heading row in the body face, its icon before it (Season). */
  header: "text-xl",
} as const;

type TitleLevel = keyof typeof LEVELS;

const SHADOWS = { title: "text-shadow-title", "title-flat": "text-shadow-title-flat" } as const;

/**
 * A title or hero line in cream: the display face by default (Bokor), or the body face in bold for a headline read as
 * words. Its level owns its size, responsive step and leading; `as` keeps the element the page's outline needs.
 */
export const Title = ({
  level,
  face = "display",
  shadow,
  as: Element = "h1",
  className,
  children,
}: {
  level: TitleLevel;
  face?: "display" | "body";
  /** The shadow that lifts a title off a painting. */
  shadow?: keyof typeof SHADOWS;
  as?: "h1" | "h2" | "p" | "span";
  className?: string;
  children: ReactNode;
}) => (
  <Element
    className={cn(
      face === "display" ? "font-display" : "font-body font-bold",
      LEVELS[level],
      "text-kit-cream",
      shadow && SHADOWS[shadow],
      className,
    )}
  >
    {children}
  </Element>
);
