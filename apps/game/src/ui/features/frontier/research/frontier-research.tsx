import { HudLoading, HudPage } from "@/ui/design-system/kit/hud-elements";
import { RESEARCH, RESEARCH_TREE } from "@/ui/design-system/kit/words";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useState } from "react";

import { useResearchActions } from "./research-actions";
import { useResearchTree } from "./research-facts";
import { ResearchPanel } from "./research-panel";

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
  const { nodes, essence, labor } = tree;
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
      essence={essence}
      labor={labor}
      castleLevel={realm.base.level}
    />
  );
};
