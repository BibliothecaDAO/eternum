import { ArmyPortrait } from "@/ui/features/frontier/attributes/army-portrait";
import {
  type ArmyProgressFacts,
  type Attribute,
  attributeLevel,
  nextTierPrice,
  type ProgressionRulesFacts,
  xpGained,
} from "@/ui/features/frontier/attributes/attributes";
import { PickChip } from "@/ui/features/frontier/attributes/pick-chip";
import { onTierBought } from "@/ui/features/frontier/attributes/pick-moment";
import { PickPanel } from "@/ui/features/frontier/attributes/pick-panel";
import { playArmyProgress } from "@/ui/features/frontier/attributes/progress-moment";
import { type ReactNode, useEffect, useRef, useState } from "react";

/** ArmyProgressionRules and ArmyProgress exactly as the native store carries them. */
const RULES: ProgressionRulesFacts = {
  game_id: 1,
  reveal_xp: 2,
  fixed_xp: 200,
  uncommon_xp: 100,
  rare_xp: 200,
  epic_xp: 400,
  legendary_xp: 800,
};
const ARMY: ArmyProgressFacts = { game_id: 1, explorer_id: 201, xp: 140, battle: 2, logistics: 1, scouting: 4, support: 1 };
const COLUMN: Record<Attribute, "battle" | "logistics" | "scouting" | "support"> = {
  Battle: "battle",
  Logistics: "logistics",
  Scouting: "scouting",
  Support: "support",
};
/** Herald's pre-confirmed result, simulated. */
const RESULT_AFTER_MS = 500;

/**
 * The army's progress from fixture rows: reveals, clears and shrines earn XP, and an Upgrade spends the next tier's
 * price. The watcher below plays the world's flourish from the fact's changes, as the world map does.
 */
export const PickLab = () => {
  const [progress, setProgress] = useState<ArmyProgressFacts>(ARMY);
  const [refuse, setRefuse] = useState(false);
  const tile = useRef<HTMLDivElement>(null);
  useProgressFlourish(progress, tile);

  const award = (amount: number) => setProgress((now) => ({ ...now, xp: now.xp + amount }));

  const commit = (attribute: Attribute) =>
    new Promise<void>((resolve, reject) =>
      window.setTimeout(() => {
        if (refuse) return reject(new Error("Not enough XP."));
        const tier = attributeLevel(progress, attribute);
        const price = nextTierPrice(RULES, tier);
        if (price === null || progress.xp < price) return reject(new Error("Not enough XP."));
        onTierBought({ explorerId: progress.explorer_id, attribute, tier: tier + 1, price });
        // The story starts the flight; the fact changes as it lands.
        window.setTimeout(
          () => setProgress((now) => ({ ...now, xp: now.xp - price, [COLUMN[attribute]]: tier + 1 })),
          450,
        );
        resolve();
      }, RESULT_AFTER_MS),
    );

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <PickPanel progress={progress} rules={RULES} commit={commit} />
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-gold/30 px-3 py-2">
        <div ref={tile} className="h-10 w-10 shrink-0 rounded-lg border border-[#8b5cf6]/60 bg-[#2a1745]" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-semibold">Army 1</span>
          <ArmyPortrait
            explorerId={progress.explorer_id}
            troops={{ category: "Knight", tier: "T1" }}
            progress={progress}
            rules={RULES}
          />
        </div>
        <PickChip progress={progress} rules={RULES} />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <LabButton onClick={() => award(RULES.reveal_xp)}>Reveal · +{RULES.reveal_xp} XP</LabButton>
        <LabButton onClick={() => award(90)}>Camp clear · +90 XP</LabButton>
        <LabButton onClick={() => award(RULES.fixed_xp)}>Shrine · +{RULES.fixed_xp} XP</LabButton>
        <LabButton onClick={() => setRefuse(!refuse)}>{refuse ? "Chain refuses" : "Chain accepts"}</LabButton>
      </div>
    </div>
  );
};

/** The world map's watcher, in the lab: each XP gain on the army's progress floats from the stand-in tile. */
const useProgressFlourish = (progress: ArmyProgressFacts, tile: React.RefObject<HTMLDivElement | null>) => {
  const before = useRef(progress);
  useEffect(() => {
    const xp = xpGained(before.current, progress);
    before.current = progress;
    if (xp <= 0) return;
    const box = tile.current?.getBoundingClientRect();
    playArmyProgress({ xp, at: box ? { x: box.left + box.width / 2, y: box.top } : null });
  }, [progress, tile]);
};

const LabButton = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className="min-h-11 rounded-lg border border-gold/40 px-3 text-sm">
    {children}
  </button>
);
