import { useGame } from "@/hooks/context/game-context";
import { useAllInFlight } from "@/hooks/store/use-actions-in-flight";
import type { Fix } from "@/ui/design-system/kit/refusal";
import { RESEARCH_TREE } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";

import { useGoToFrontierPlace } from "../frontier-home";
import { exploreFix } from "../frontier-reveal-yield";
import type { Need, TreeNode } from "./research-tree";
import { researchKey, sendResearch } from "./send-research";

/**
 * What a research choice does, wherever it stands (the Research page, a building's card): send the node's next tier with
 * a side, say whether a row's research is under way, and the step that clears a need. A need on another node (the
 * Barracks' gate) opens that node through `openNode`.
 */
export const useResearchActions = (realm: NativeRows["Structure"], openNode: (key: string) => void) => {
  const { setup, account } = useGame();
  const goToPlace = useGoToFrontierPlace(realm);
  const researching = useAllInFlight("research");

  const sending = (node: TreeNode) => researching.has(researchKey(realm, node.row));

  const research = async (node: TreeNode, side: number) => {
    try {
      await sendResearch(setup.systemCalls, account.account, realm, { row: node.row, choice: side }, () => undefined);
    } catch (error) {
      toast.failed(error, "The research could not be sent.");
    }
  };

  /** The step that clears a need: the map for Essence or labor, the board for a building or the castle, the gate's node. */
  const fixFor = (need: Need, node: TreeNode, nodes: readonly TreeNode[]): Fix | undefined => {
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
        return opener && { icon: need.icon, word: opener.name, onFix: () => openNode(opener.key) };
      }
    }
  };

  return { sending, research, fixFor };
};
