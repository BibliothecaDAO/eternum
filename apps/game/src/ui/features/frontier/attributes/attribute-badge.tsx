import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Sweep } from "@/ui/motion/sweep";
import { useEffect, useRef, useState } from "react";
import {
  ATTRIBUTE_LOOK,
  ATTRIBUTES,
  type ArmyProgressFacts,
  attributeBadgeTarget,
  attributeLevel,
  MAX_ATTRIBUTE_LEVEL,
} from "./attributes";

/**
 * An army's attributes at a glance: each one's icon and five pips, from ArmyProgress. A chosen card lands here, and the
 * pip it earns fills with a sweep; level five wears a gold border.
 */
export const AttributeBadge = ({ progress, className }: { progress: ArmyProgressFacts; className?: string }) => (
  <span
    data-fly-target={attributeBadgeTarget(progress.explorer_id)}
    aria-label="Attributes"
    className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}
  >
    {ATTRIBUTES.map((attribute) => (
      <AttributePips key={attribute} attribute={attribute} level={attributeLevel(progress, attribute)} />
    ))}
  </span>
);

const AttributePips = ({ attribute, level }: { attribute: (typeof ATTRIBUTES)[number]; level: number }) => {
  const Icon = ATTRIBUTE_LOOK[attribute].icon;
  // A level gained since the last render sweeps its pips once.
  const shown = useRef(level);
  const [sweeps, setSweeps] = useState(0);
  useEffect(() => {
    if (level > shown.current) setSweeps((count) => count + 1);
    shown.current = level;
  }, [level]);
  const max = level >= MAX_ATTRIBUTE_LEVEL;
  return (
    <Sweep play={sweeps} className={cn("rounded-full", max && "ring-1 ring-gold")}>
      <span className="flex items-center gap-0.5 px-0.5" title={`${attribute} ${level}${max ? " · Max" : ""}`}>
        <Icon className="h-3 w-3 text-gold/80" aria-hidden />
        {Array.from({ length: MAX_ATTRIBUTE_LEVEL }, (_, index) => (
          <span
            key={index}
            className={cn("h-1.5 w-1.5 rounded-full", index < level ? "bg-gold" : "border border-gold/30")}
          />
        ))}
      </span>
    </Sweep>
  );
};
