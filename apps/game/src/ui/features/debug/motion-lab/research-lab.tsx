import { ResearchSheet } from "@/ui/features/frontier/research/research-sheet";
import { useState } from "react";
import { researchPlanFixture } from "./research-fixtures";

/** Farm II already learned and 1,250 Essence, as mockup 3 draws it; a node bought here is learned half a second on. */
export const ResearchLab = () => {
  const [open, setOpen] = useState(false);
  const [learned, setLearned] = useState(1 << 0);
  const [essence, setEssence] = useState(1_250);
  const plan = researchPlanFixture(learned, essence);
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-lg border border-gold/40 px-3 text-sm"
      >
        Open research
      </button>
      {open && (
        <ResearchSheet
          plan={plan}
          onClose={() => setOpen(false)}
          research={(node) =>
            new Promise((resolve) =>
              window.setTimeout(() => {
                setLearned((mask) => mask | (1 << node.node));
                setEssence((left) => left - node.price);
                resolve();
              }, 500),
            )
          }
        />
      )}
    </div>
  );
};
