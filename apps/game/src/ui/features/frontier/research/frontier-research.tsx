import { useGame } from "@/hooks/context/game-context";
import { useAllInFlight } from "@/hooks/store/use-actions-in-flight";
import type { Fix } from "@/ui/design-system/kit/refusal";
import { RESEARCH_TREE } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";

import { useGoToFrontierPlace } from "../frontier-home";
import { exploreFix } from "../frontier-reveal-yield";
import { useResearchTree } from "./research-facts";
import { ResearchPanel } from "./research-panel";
import type { Need, TreeNode } from "./research-tree";
import { researchKey, sendResearch } from "./send-research";

/**
 * The castle's tree over the game's facts, Frontier's Research page: the tree, the picked node under it, and Research
 * with the side picked. `pick` opens on a node (a building tapped on the board opens its own row); otherwise the page
 * opens on the first node the realm can research, else the first it is saving for.
 */
export const FrontierResearch = ({ realm, pick }: { realm: NativeRows["Structure"]; pick?: string }) => {
  const { setup, account } = useGame();
  const tree = useResearchTree(realm);
  const goToPlace = useGoToFrontierPlace(realm);
  const researching = useAllInFlight("research");
  const [picked, setPicked] = useState<string | undefined>(pick);
  if (!tree) return null;
  const { nodes } = tree;
  const sending = new Set(nodes.flatMap(({ row }) => (researching.has(researchKey(realm, row)) ? [row] : [])));

  const research = async (node: TreeNode, side: number) => {
    try {
      await sendResearch(setup.systemCalls, account.account, realm, { row: node.row, choice: side }, () => undefined);
    } catch (error) {
      toast.failed(error, "The research could not be sent.");
    }
  };

  /** The step that clears a need: the map for Essence or labor, the board for a building or the castle, the gate's node. */
  const fixFor = (need: Need, node: TreeNode): Fix | undefined => {
    switch (need.kind) {
      case "essence":
        return exploreFix(ResourcesIds.Essence, () => goToPlace(true));
      case "labor":
        return exploreFix(ResourcesIds.Labor, () => goToPlace(true));
      case "stands":
        return { icon: need.icon, word: RESEARCH_TREE.build(need.building), onFix: () => goToPlace(false) };
      case "store":
        return { icon: "realm", word: RESEARCH_TREE.levelUpCastle, onFix: () => goToPlace(false) };
      case "tier": {
        const opener = nodes.find((candidate) => candidate.leadsTo.includes(node.key));
        return opener && { icon: need.icon, word: opener.name, onFix: () => setPicked(opener.key) };
      }
    }
  };

  return (
    <ResearchPanel
      nodes={nodes}
      essence={tree.essence}
      labor={tree.labor}
      picked={picked ?? firstToResearch(nodes)}
      onPick={setPicked}
      sending={sending}
      fixFor={fixFor}
      onResearch={research}
    />
  );
};

/** The node the page opens on: the first the realm can research now, else the first it is saving for, else the first. */
const firstToResearch = (nodes: readonly TreeNode[]) =>
  (nodes.find(({ state }) => state === "ready") ?? nodes.find(({ state }) => state === "short") ?? nodes[0]!).key;
