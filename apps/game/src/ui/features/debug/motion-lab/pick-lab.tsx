import { ArmyPortrait } from "@/ui/features/frontier/attributes/army-portrait";
import { AttributeBadge } from "@/ui/features/frontier/attributes/attribute-badge";
import {
  type ArmyProgressFacts,
  type Attribute,
  type AttributeOfferFacts,
  levelProgress,
  progressChange,
  type ProgressionRulesFacts,
} from "@/ui/features/frontier/attributes/attributes";
import { PickChip } from "@/ui/features/frontier/attributes/pick-chip";
import { onAttributeChosen, openPick, shouldAutoOpenPick } from "@/ui/features/frontier/attributes/pick-moment";
import { PickPanel } from "@/ui/features/frontier/attributes/pick-panel";
import { playArmyProgress } from "@/ui/features/frontier/attributes/progress-moment";
import { type ReactNode, useEffect, useRef, useState } from "react";

/** ArmyProgressionRules and ArmyProgress exactly as the agreed shapes carry them (backend shapes v6). */
const RULES: ProgressionRulesFacts = { game_id: 1, reveal_xp: 10, clear_xp: 25, level_step_xp: 20 };
const ARMY: ArmyProgressFacts = {
  game_id: 1,
  explorer_id: 201,
  level: 3,
  xp: 40,
  battle: 2,
  logistics: 1,
  scouting: 4,
  support: 1,
  pending: null,
};
const RELIC_OFFER: AttributeOfferFacts = {
  id: 900,
  source: "Relic",
  amount: 3,
  choices: ["Battle", "Scouting", "Logistics"],
};
const LEVEL_CHOICES: readonly Attribute[] = ["Battle", "Scouting", "Support"];
const COLUMN: Record<Attribute, "battle" | "logistics" | "scouting" | "support"> = {
  Battle: "battle",
  Logistics: "logistics",
  Scouting: "scouting",
  Support: "support",
};
/** Herald's pre-confirmed result, simulated. */
const RESULT_AFTER_MS = 500;

let offers = 0;

/**
 * The contract's earned-level step (backend shapes v6): with no offer waiting, XP that covers the level's threshold
 * spends it, carries the rest, levels the army once and persists its offer. While an offer waits, XP only banks.
 */
const withOffer = (progress: ArmyProgressFacts): ArmyProgressFacts => {
  const { needed } = levelProgress(progress, RULES);
  if (progress.pending || progress.xp < needed) return progress;
  return {
    ...progress,
    level: progress.level + 1,
    xp: progress.xp - needed,
    pending: { id: (offers += 1), source: "Level", amount: 1, choices: LEVEL_CHOICES },
  };
};

/**
 * The army's progress from fixture rows: reveals and clears earn XP, a covered threshold levels the army and emits its
 * offer (the session's first opens the panel), and XP earned while it waits banks toward the next. The watcher below plays the world's flourish from the
 * fact's changes, as the world map will.
 */
export const PickLab = () => {
  const [progress, setProgress] = useState<ArmyProgressFacts>(ARMY);
  const [refuse, setRefuse] = useState(false);
  const tile = useRef<HTMLDivElement>(null);
  useProgressFlourish(progress, tile);

  useEffect(() => {
    if (progress.pending && shouldAutoOpenPick(progress.pending)) openPick(progress.explorer_id, progress.pending);
  }, [progress.explorer_id, progress.pending]);

  const award = (amount: number) => setProgress((now) => withOffer({ ...now, xp: now.xp + amount }));

  const commit = (attribute: Attribute) =>
    new Promise<void>((resolve, reject) =>
      window.setTimeout(() => {
        if (refuse) return reject(new Error("This offer was already answered."));
        const pending = progress.pending;
        if (!pending) return reject(new Error("No offer is waiting."));
        const before = progress[COLUMN[attribute]];
        const applied = Math.min(5, before + pending.amount) - before;
        onAttributeChosen({
          explorerId: progress.explorer_id,
          offerId: pending.id,
          attribute,
          applied,
          lost: pending.amount - applied,
        });
        // The story starts the flight; the fact changes as it lands: the pick applies, then the next earned level, if due.
        window.setTimeout(
          () => setProgress((now) => withOffer({ ...now, [COLUMN[attribute]]: before + applied, pending: null })),
          450,
        );
        resolve();
      }, RESULT_AFTER_MS),
    );

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <PickPanel progress={progress} commit={commit} />
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
          <AttributeBadge progress={progress} />
        </div>
        <PickChip progress={progress} rules={RULES} />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <LabButton onClick={() => award(RULES.reveal_xp)}>Reveal · +{RULES.reveal_xp} XP</LabButton>
        <LabButton onClick={() => award(RULES.clear_xp)}>Clear · +{RULES.clear_xp} XP</LabButton>
        <LabButton onClick={() => setProgress((now) => (now.pending ? now : { ...now, pending: RELIC_OFFER }))}>
          Relic · +3
        </LabButton>
        <LabButton onClick={() => setRefuse(!refuse)}>{refuse ? "Chain refuses" : "Chain accepts"}</LabButton>
      </div>
    </div>
  );
};

/** The world map's watcher, in the lab: each change to the army's progress plays its flourish from the stand-in tile. */
const useProgressFlourish = (progress: ArmyProgressFacts, tile: React.RefObject<HTMLDivElement | null>) => {
  const before = useRef(progress);
  useEffect(() => {
    const change = progressChange(before.current, progress, RULES);
    before.current = progress;
    if (change.xp <= 0 && change.levels <= 0) return;
    const box = tile.current?.getBoundingClientRect();
    playArmyProgress({
      ...change,
      at: box ? { x: box.left + box.width / 2, y: box.top } : null,
      // The world's ring burst plays through the scene's playBurst; the lab has no world.
      burst: () => {},
    });
  }, [progress, tile]);
};

const LabButton = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className="min-h-11 rounded-lg border border-gold/40 px-3 text-sm">
    {children}
  </button>
);
