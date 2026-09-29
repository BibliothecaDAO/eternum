import { beginChestOpening, resolveChestOpening, useChestMoment } from "@/ui/features/frontier/chest/chest-moment";
import { Hold } from "@/ui/motion/hold";
import type { Intensity } from "@/ui/motion/motion-scale";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { type ChestVariant, chestResultFixture } from "./chest-fixtures";

/** Herald's pre-confirmed result: well inside the hold, or late enough to show the "Opening…" caption. */
const RESULT_AFTER_MS = { quick: 300, slow: 3_200 } as const;

let opened = 0;

/**
 * The chest moment from fixture rows: a stand-in chest that holds while the result is pending, and the real overlay
 * over it. The world's C2 chest plays the same beats from the same state on the map.
 */
export const ChestLab = ({ intensity }: { intensity: Intensity }) => {
  const chest = useRef<HTMLDivElement>(null);
  const moment = useChestMoment();
  const [slow, setSlow] = useState(false);
  useChestPhaseLog();

  const open = (variant: ChestVariant) => {
    const box = chest.current?.getBoundingClientRect();
    if (!box || moment) return;
    beginChestOpening({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
    const result = chestResultFixture(variant, intensity, (opened += 1));
    window.setTimeout(() => resolveChestOpening(result), RESULT_AFTER_MS[slow ? "slow" : "quick"]);
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <Hold
        key={moment?.openedAt ?? "idle"}
        pending={moment?.phase === "anticipation"}
        intensity={intensity}
        minMs={0}
        onSettled={() => {}}
      >
        <div ref={chest} className="rounded-xl border border-[#8b5cf6]/70 bg-[#2a1745] px-6 py-4 text-sm">
          C2 chest
        </div>
      </Hold>
      <div className="flex flex-wrap justify-center gap-2">
        <LabButton onClick={() => open("lords")}>Open · LORDS</LabButton>
        <LabButton onClick={() => open("relic")}>Open · relic</LabButton>
        <LabButton onClick={() => open("spent")}>Open · LORDS spent</LabButton>
        <LabButton onClick={() => setSlow(!slow)}>{slow ? "Result in 3.2 s" : "Result in 0.3 s"}</LabButton>
      </div>
    </div>
  );
};

/** The labs' pacing record: each beat's start after the tap, in the console, for timing captures. */
export const useChestPhaseLog = () => {
  const moment = useChestMoment();
  const phase = moment?.phase ?? "closed";
  const tappedAt = useRef<number | null>(null);
  if (moment) tappedAt.current = moment.openedAt;
  useEffect(() => {
    if (tappedAt.current === null) return;
    console.info(`[chest-lab] ${phase} +${Math.round(performance.now() - tappedAt.current)} ms`);
  }, [phase]);
};

const LabButton = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className="min-h-11 rounded-lg border border-gold/40 px-3 text-sm">
    {children}
  </button>
);
