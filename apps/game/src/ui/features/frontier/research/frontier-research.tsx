import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useState } from "react";

import { useResearchActions } from "./research-actions";
import { useResearchTree } from "./research-facts";
import { ResearchPanel } from "./research-panel";
import type { TreeNode } from "./research-tree";

/**
 * The castle's tree over the game's facts, Frontier's Research page: the tree, the picked node's choice at its foot, and
 * Research with the side picked. `pick` opens on a node (a card's way to its research); otherwise the page opens on the
 * first node the realm can research, else the first it is saving for.
 */
export const FrontierResearch = ({ realm, pick }: { realm: NativeRows["Structure"]; pick?: string }) => {
  const tree = useResearchTree(realm);
  // Undefined until the player picks: the page opens on its first node; null once its choice is put away.
  const [picked, setPicked] = useState<string | null | undefined>(pick);
  const actions = useResearchActions(realm, setPicked);
  if (!tree) return null;
  const { nodes } = tree;
  const sending = new Set(nodes.filter(actions.sending).map(({ row }) => row));

  return (
    <ResearchPanel
      nodes={nodes}
      essence={tree.essence}
      labor={tree.labor}
      picked={picked === undefined ? firstToResearch(nodes) : picked}
      onPick={setPicked}
      sending={sending}
      fixFor={(need, node) => actions.fixFor(need, node, nodes)}
      onResearch={actions.research}
    />
  );
};

/** The node the page opens on: the first the realm can research now, else the first it is saving for, else the first. */
const firstToResearch = (nodes: readonly TreeNode[]) =>
  (nodes.find(({ state }) => state === "ready") ?? nodes.find(({ state }) => state === "short") ?? nodes[0]!).key;
