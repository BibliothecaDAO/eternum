import "./reveal-pill.css";

import { Icon } from "@/ui/design-system/icon";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { clearRevealGains, REVEAL_GAINS_MS, useRevealGains } from "@/ui/motion/moments/reveal-gains";
import { formatShort, resourceName } from "@bibliothecadao/types";
import { useEffect } from "react";

export const RevealPill = () => {
  const { gains, at } = useRevealGains();
  useEffect(() => {
    if (at === 0) return;
    const goes = setTimeout(clearRevealGains, REVEAL_GAINS_MS);
    return () => clearTimeout(goes);
  }, [at]);
  const paid = [...gains];
  if (paid.length === 0) return null;
  return (
    <p role="status" className="ui-panel reveal-pill" data-reveal-pill>
      {paid.map(([resource, amount]) => (
        <span key={resource} aria-label={`${formatShort(amount, { signed: true })} ${resourceName(resource)}`}>
          <Icon name={resourceMeaning(resource)} size={20} />
          <b>{formatShort(amount, { signed: true })}</b>
        </span>
      ))}
    </p>
  );
};
