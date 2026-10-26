import { cn } from "@/ui/design-system/atoms/lib/utils";
import { realmMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon } from "@/ui/design-system/icon";
import { rankStep } from "@/ui/design-system/kit/words";
import { rankName } from "@bibliothecadao/types";

/**
 * A realm's place on its ranks' ladder (the owner, 22 October: "the ranks own steps"): each rank's castle from the
 * first to the highest, the ones reached lit and the ones to come dimmed. It is the realm's rank, never a tier: the
 * tier gems mean tiers.
 */
export const RankSteps = ({ level, highest }: { level: number; highest: number }) => {
  const ranks = Array.from({ length: highest + 1 }, (_, rank) => rank);
  const line = rankStep(rankName(level), level + 1, ranks.length);
  return (
    <span role="img" aria-label={line} data-tip={line} className="inline-flex shrink-0 items-center gap-0.5">
      {ranks.map((rank) => (
        <span key={rank} className={cn("inline-flex", rank > level && "opacity-30 grayscale")}>
          <Icon name={realmMeaning(rank)} size={20} />
        </span>
      ))}
    </span>
  );
};
