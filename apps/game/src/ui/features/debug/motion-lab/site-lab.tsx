import { BankedHolding } from "@/ui/features/frontier/frontier-status-strip";
import { SiteClearCardView } from "@/ui/features/frontier/sites/site-clear-card";
import { playSiteClear } from "@/ui/features/frontier/sites/site-clear-moment";
import type { SiteClear } from "@/ui/features/frontier/sites/site-outcome";
import { ResourcesIds } from "@bibliothecadao/types";
import { type ReactNode, useRef, useState } from "react";

/** Site payouts as the world update listener reads them from SitePayout stories, in whole units. */
const STORIES: Record<"camp" | "rift" | "fallen", SiteClear> = {
  camp: { kind: "Camp", reward: { resourceId: ResourcesIds.Labor, amount: 550 } },
  rift: { kind: "Rift", reward: { resourceId: ResourcesIds.Essence, amount: 3_300 } },
  fallen: { kind: "FallenRealm", reward: null },
};
const TROOPS_LOST = 420;

/**
 * A site cleared from fixture stories: the banked counters are the status strip's own, and the realm's balance fact
 * changes at once, as it would with the story, while the counter holds its number until the payout lands.
 */
export const SiteLab = () => {
  const site = useRef<HTMLDivElement>(null);
  const [balances, setBalances] = useState({ [ResourcesIds.Labor]: 1_250, [ResourcesIds.Essence]: 150 });
  const [counters, setCounters] = useState(true);

  const clear = (which: keyof typeof STORIES) => {
    const result = STORIES[which];
    const box = site.current?.getBoundingClientRect();
    if (!box) return;
    if (result.reward) {
      const { resourceId, amount } = result.reward;
      setBalances((now) => ({ ...now, [resourceId]: (now[resourceId as keyof typeof now] ?? 0) + amount }));
    }
    playSiteClear({
      clear: result,
      troopsLost: TROOPS_LOST,
      at: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
      // The dust burst of 24 plays through the scene's playBurst; the lab has no world.
      burst: () => {},
    });
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* The card sits in the thumb zone in the HUD; here it takes the top of the panel so it stays in view. */}
      <SiteClearCardView />
      {counters && (
        <dl className="flex items-center gap-4 rounded-lg border border-gold/20 px-3 py-2">
          <BankedHolding resourceId={ResourcesIds.Essence} amount={balances[ResourcesIds.Essence]} />
          <BankedHolding resourceId={ResourcesIds.Labor} amount={balances[ResourcesIds.Labor]} />
        </dl>
      )}
      <div ref={site} className="rounded-xl border border-[#b8801a]/70 bg-[#3a2a12] px-6 py-4 text-sm">
        Guarded site
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <LabButton onClick={() => clear("camp")}>Clear camp · +550 labor</LabButton>
        <LabButton onClick={() => clear("rift")}>Clear rift · +3,300 Essence</LabButton>
        <LabButton onClick={() => clear("fallen")}>Clear fallen realm</LabButton>
        <LabButton onClick={() => setCounters(!counters)}>{counters ? "Hide counters" : "Show counters"}</LabButton>
      </div>
    </div>
  );
};

const LabButton = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className="min-h-11 rounded-lg border border-gold/40 px-3 text-sm">
    {children}
  </button>
);
