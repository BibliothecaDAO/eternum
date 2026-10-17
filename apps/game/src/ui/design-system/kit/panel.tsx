import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import type { ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

type Rule = "gilded" | "line";

/**
 * A panel's title: its icon and words over a rule, a figure or chip at its end. Gilded, the plate's gold rule under a
 * bold title (a board, a post's side panel); line, a plain line under a larger title (an entry, a wallet, a reward).
 */
export const PanelTitle = ({
  icon,
  rule = "gilded",
  aside,
  className,
  children,
}: {
  icon: IconMeaning;
  rule?: Rule;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <h2
    className={cn(
      "flex items-center text-kit-cream",
      rule === "gilded"
        ? "plate-title gap-2 px-1 font-body text-body font-bold"
        : "gap-2.5 border-b border-kit-line pb-3 font-body text-lead",
      className,
    )}
  >
    <SemanticIcon name={icon} size={rule === "gilded" ? 22 : 26} />
    {children}
    {aside && <span className="ml-auto">{aside}</span>}
  </h2>
);

/**
 * A titled panel: its `PanelTitle`, then its rows. On a plate (padded small or large) or bare, inside a plate already
 * drawn around it.
 */
export const Panel = ({
  icon,
  title,
  aside,
  rule = "gilded",
  surface = "plate",
  pad = "sm",
  titleClassName,
  children,
}: {
  icon: IconMeaning;
  title: string;
  aside?: ReactNode;
  rule?: Rule;
  surface?: "plate" | "bare";
  /** A plate's padding; a bare panel has none. */
  pad?: "sm" | "lg";
  titleClassName?: string;
  children: ReactNode;
}) => (
  <section
    className={cn(
      "flex flex-col",
      rule === "gilded" ? "gap-1" : "gap-4",
      surface === "plate" && cn("plate", pad === "sm" ? "p-3" : "p-5"),
    )}
  >
    <PanelTitle icon={icon} rule={rule} aside={aside} className={titleClassName}>
      {title}
    </PanelTitle>
    {children}
  </section>
);
