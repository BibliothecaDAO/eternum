import { HudLoading, HudPage } from "@/ui/design-system/kit/hud-elements";
import { RESEARCH, RESEARCH_TREE } from "@/ui/design-system/kit/words";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useState } from "react";

import { useResearchActions } from "./research-actions";
import { useResearchTree } from "./research-facts";
import { ResearchPanel } from "./research-panel";

/**
 * The castle's tree over the game's facts, Frontier's Research page: the tree, the picked node's choice at its foot, and
 * Research with the side picked. `pick` opens on a node (a card's way to its research); otherwise the page opens on the
 * tree alone, to browse (owner, 27 October: "it shouldnt open up the one I can research I just wanna browse").
 * Until every fact the tree reads has arrived, the page says so, in its frame.
 */
export const FrontierResearch = ({
  realm,
  pick,
  onClose,
}: {
  realm: NativeRows["Structure"];
  pick?: string;
  onClose: () => void;
}) => {
  const tree = useResearchTree(realm);
  const [picked, setPicked] = useState<string | null>(pick ?? null);
  const actions = useResearchActions(realm, setPicked);
  if (!tree)
    return (
      <HudPage label={RESEARCH} icon="research" onClose={onClose}>
        <HudLoading line={RESEARCH_TREE.onItsWay} />
      </HudPage>
    );
  const { nodes } = tree;
  const sending = new Set(nodes.filter(actions.sending).map(({ row }) => row));

  return (
    <ResearchPanel
      nodes={nodes}
      picked={picked}
      onPick={setPicked}
      sending={sending}
      fixFor={(need, node) => actions.fixFor(need, node, nodes)}
      onResearch={actions.research}
      onClose={onClose}
    />
  );
};
