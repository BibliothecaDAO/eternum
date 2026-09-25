import { AttributeBadge } from "@/ui/features/frontier/attributes/attribute-badge";
import type { ArmyProgressFacts, Attribute, AttributeOfferFacts } from "@/ui/features/frontier/attributes/attributes";
import { PickChip } from "@/ui/features/frontier/attributes/pick-chip";
import { onAttributeChosen, openPick } from "@/ui/features/frontier/attributes/pick-moment";
import { PickPanel } from "@/ui/features/frontier/attributes/pick-panel";
import { type ReactNode, useState } from "react";

/** ArmyProgress exactly as the agreed shapes carry it (backend shapes v5), with a level-up offer waiting. */
const ARMY: ArmyProgressFacts = {
  explorer_id: 201,
  level: 3,
  xp: 40,
  battle: 2,
  logistics: 1,
  scouting: 4,
  support: 1,
  pending: null,
};
const OFFERS: Record<"level" | "relic", AttributeOfferFacts> = {
  level: { id: 7, source: "Level", amount: 1, choices: ["Battle", "Scouting", "Support"] },
  relic: { id: 8, source: "Relic", amount: 3, choices: ["Battle", "Scouting", "Logistics"] },
};
const COLUMN: Record<Attribute, "battle" | "logistics" | "scouting" | "support"> = {
  Battle: "battle",
  Logistics: "logistics",
  Scouting: "scouting",
  Support: "support",
};
/** Herald's pre-confirmed result, simulated. */
const RESULT_AFTER_MS = 500;

/**
 * The pick from fixture rows: an army card with its badge and waiting chip, and the panel. Choosing answers after a
 * moment with the army's new progress and an AttributeChosen story, or refuses with a reason.
 */
export const PickLab = () => {
  const [progress, setProgress] = useState<ArmyProgressFacts>(ARMY);
  const [refuse, setRefuse] = useState(false);

  const offer = (kind: "level" | "relic") => {
    setProgress({ ...ARMY, pending: OFFERS[kind] });
    openPick(ARMY.explorer_id, OFFERS[kind]);
  };

  const commit = (attribute: Attribute) =>
    new Promise<void>((resolve, reject) =>
      window.setTimeout(() => {
        if (refuse) return reject(new Error("This offer was already answered."));
        const pending = progress.pending;
        if (!pending) return reject(new Error("No offer is waiting."));
        const before = progress[COLUMN[attribute]];
        const applied = Math.min(5, before + pending.amount) - before;
        onAttributeChosen({
          explorer_id: progress.explorer_id,
          offer_id: pending.id,
          attribute,
          applied,
          lost: pending.amount - applied,
        });
        // The story starts the flight; the fact changes as it lands.
        window.setTimeout(
          () => setProgress((now) => ({ ...now, [COLUMN[attribute]]: before + applied, pending: null })),
          450,
        );
        resolve();
      }, RESULT_AFTER_MS),
    );

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <PickPanel progress={progress} commit={commit} />
      <div className="flex items-center gap-3 rounded-xl border border-gold/30 px-3 py-2">
        <span className="text-sm font-semibold">Army 1</span>
        <AttributeBadge progress={progress} />
        <PickChip progress={progress} />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <LabButton onClick={() => offer("level")}>Level up · +1</LabButton>
        <LabButton onClick={() => offer("relic")}>Relic · +3</LabButton>
        <LabButton onClick={() => setRefuse(!refuse)}>{refuse ? "Chain refuses" : "Chain accepts"}</LabButton>
      </div>
    </div>
  );
};

const LabButton = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className="min-h-11 rounded-lg border border-gold/40 px-3 text-sm">
    {children}
  </button>
);
