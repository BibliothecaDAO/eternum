import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import type { ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

/**
 * One line of a panel led by its meaning: what holds, what comes next, what a step costs. Cream for what the player has
 * to know, muted for what is only told; the season prize's lines carry a smaller mark.
 */
export const IconLine = ({
  icon,
  tone,
  iconSize = 24,
  children,
}: {
  icon: IconMeaning;
  tone: "cream" | "muted";
  iconSize?: 22 | 24;
  children: ReactNode;
}) => (
  <p
    className={cn(
      "flex items-center gap-2.5 font-body text-base",
      tone === "cream" ? "text-kit-cream" : "text-kit-muted",
    )}
  >
    <SemanticIcon name={icon} size={iconSize} />
    <span>{children}</span>
  </p>
);
