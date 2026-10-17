import type { ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

/**
 * The small bold heading over a group of a page: Play's "Now" and "Next and done" in peach, a settings group's name in
 * gold.
 */
export const SectionLabel = ({
  tone = "peach",
  size = "caption",
  className,
  children,
}: {
  tone?: "peach" | "gold";
  size?: "caption" | "body";
  className?: string;
  children: ReactNode;
}) => (
  <h2
    className={cn(
      "font-body font-bold",
      size === "caption" ? "text-caption" : "text-body",
      tone === "peach" ? "text-kit-peach" : "text-kit-gold",
      className,
    )}
  >
    {children}
  </h2>
);
