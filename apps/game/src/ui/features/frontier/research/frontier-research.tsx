import { useGame } from "@/hooks/context/game-context";
import { requestUnlockFlight } from "@/three/scenes/hexception-unlock-request";
import { FlaskConical } from "@/ui/design-system/atoms/game-icons";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useState } from "react";
import type { Account } from "starknet";
import { useResearchPlan } from "./research-reader";
import type { ResearchNodeView } from "./research-plan";
import { nodeArt, ResearchSheet } from "./research-sheet";

/**
 * Research in Frontier's HUD: a flask that opens the realm's tree once its knowledge is known. A node bought sends
 * Research; a building tier's unlock then flies from its medallion into that building on the realm board.
 */
export const FrontierResearch = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup, account } = useGame();
  const plan = useResearchPlan(realm);
  const [open, setOpen] = useState(false);

  const research = async (node: ResearchNodeView) => {
    const from = medallionCentre(node);
    try {
      await setup.systemCalls.research({
        signer: account.account as unknown as Account,
        structureId: realm.entity_id,
        node: node.node,
      });
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The research could not be sent."));
      return;
    }
    setOpen(false);
    if (node.effect.kind === "tier" && from)
      requestUnlockFlight({ category: node.effect.category, from, icon: nodeArt(node) });
  };

  return (
    <>
      <button
        type="button"
        aria-label="Research"
        disabled={!plan}
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex size-11 items-center justify-center rounded-full border border-gold/25 bg-black/50 disabled:opacity-40 lg:size-9"
      >
        <FlaskConical className="size-5" />
      </button>
      {open && plan && <ResearchSheet plan={plan} research={research} onClose={() => setOpen(false)} />}
    </>
  );
};

const medallionCentre = (node: ResearchNodeView): { x: number; y: number } | null => {
  const box = document.querySelector(`[data-research-node="${node.node}"]`)?.getBoundingClientRect();
  return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
};
