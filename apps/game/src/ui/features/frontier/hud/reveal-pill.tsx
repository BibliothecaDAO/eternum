import "./reveal-pill.css";

import { Icon } from "@/ui/design-system/icon";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { clearRevealGains, REVEAL_GAINS_MS, useRevealGains } from "@/ui/motion/moments/reveal-gains";
import { formatShort, resourceName, type ResourcesIds } from "@bibliothecadao/types";
import { useEffect } from "react";

/** What the player's reveals just paid, as one pill under the bar (Neon's reveal result), gone by itself. */
export const RevealPill = () => {
  const { gains, at } = useRevealGains();
  useEffect(() => {
    if (at === 0) return;
    const goes = setTimeout(clearRevealGains, REVEAL_GAINS_MS);
    return () => clearTimeout(goes);
  }, [at]);
  const paid = Object.entries(gains) as [`${ResourcesIds}`, number][];
  if (paid.length === 0) return null;
  return (
    <p role="status" className="reveal-pill" data-reveal-pill>
      {paid.map(([resource, amount]) => (
        <span key={resource} aria-label={`${formatShort(amount, { signed: true })} ${resourceName(Number(resource))}`}>
          <Icon name={resourceMeaning(Number(resource))} size={20} />
          <b>{formatShort(amount, { signed: true })}</b>
        </span>
      ))}
    </p>
  );
};
