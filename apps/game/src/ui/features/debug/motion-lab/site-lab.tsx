import { StatusStrip } from "@/ui/features/frontier/hud/status-strip";
import { bankedCounterTarget } from "@/ui/motion/moments/banked-flight";
import { SiteClearCard } from "@/ui/features/frontier/sites/site-clear-card";
import { closeSiteClearCard, useSiteClearCard } from "@/ui/features/frontier/sites/site-clear-moment";
import { AnimatePresence } from "framer-motion";
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
      <LabClearCard />
      {counters && (
        <div className="w-[390px]">
          <StatusStrip
            clock={NO_CLOCK}
            stores={[
              labStore("essence", ResourcesIds.Essence, balances[ResourcesIds.Essence]),
              labStore("labor", ResourcesIds.Labor, balances[ResourcesIds.Labor]),
            ]}
          />
        </div>
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

/** The lab has no game clock: the strip's dial and clock line read as unknown. */
const NO_CLOCK = {
  day: undefined,
  endsAt: undefined,
  secondsLeft: undefined,
  tomorrowSeconds: undefined,
  shareLeft: undefined,
  tone: "calm",
} as const;

const labStore = (kind: "essence" | "labor", resourceId: ResourcesIds, amount: number | undefined) => ({
  kind,
  amount,
  limit: undefined,
  tone: "calm" as const,
  flyTarget: bankedCounterTarget(resourceId),
});

/** The clear card the lab's clear plays; the lab has no game, so the XP reads unknown. */
const LabClearCard = () => {
  const card = useSiteClearCard();
  return (
    <AnimatePresence>
      {card && (
        <SiteClearCard
          key={card.shownAt}
          site={card.clear.kind}
          paid={
            card.clear.reward && { icon: card.clear.kind === "Camp" ? "La" : "Es", amount: card.clear.reward.amount }
          }
          xp={undefined}
          troopsLost={card.troopsLost}
          onClose={closeSiteClearCard}
        />
      )}
    </AnimatePresence>
  );
};
