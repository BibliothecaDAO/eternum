import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import { ETHEREAL, MAP, REACH_NUMERALS, SHRINE, STAMINA, WELL, XP } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { knownBalance } from "@/ui/utils/utils";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { getBalance } from "@bibliothecadao/eternum";
import { nativeRuleConstants, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";
import type { Account } from "starknet";

import { useGoToFrontierPlace } from "../frontier-home";
import { realmPerHour, secondsUntilHeld } from "../hud/army-order";
import { depthNode, type ResearchNodeView, siteNode } from "./research-plan";
import { useResearchPlan } from "./research-reader";
import { type CastleNode, CastleNodeSheet, TreePage } from "./tree-page";

/**
 * The castle's tree over the game's facts, a nav page: the castle rows from the realm's research (shrine, well and the
 * three reaches), each opening its sheet with Research. The building type rows arrive with the contracts' research
 * rows (RealmKnowledge.learned, read through core's realm-research decoder).
 */
export const FrontierResearch = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup, account } = useGame();
  const tick = useCurrentDefaultTick();
  const plan = useResearchPlan(realm);
  const goToPlace = useGoToFrontierPlace(realm);
  const [open, setOpen] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const castle = plan ? castleNodes(plan) : [];
  const labor = knownBalance(getBalance(realm.entity_id, ResourcesIds.Labor, tick, setup.store).balance);
  const chosen = castle.find((node) => node.node.key === open);

  const research = async (node: ResearchNodeView) => {
    setSending(true);
    try {
      await setup.systemCalls.research({
        signer: account.account as unknown as Account,
        structureId: realm.entity_id,
        node: node.node,
      });
      setOpen(null);
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The research could not be sent."));
    } finally {
      setSending(false);
    }
  };

  const essence = plan?.essence;
  return (
    <>
      <TreePage
        essence={essence === undefined ? undefined : Math.floor(essence)}
        labor={labor === undefined ? undefined : Math.floor(labor)}
        rows={[]}
        castle={castle.map(({ node }) => node)}
        onRow={() => undefined}
        onCastle={setOpen}
      />
      {chosen && (
        <CastleNodeSheet
          node={chosen.node}
          gives={chosen.gives}
          short={
            essence !== undefined && essence < chosen.node.essence
              ? {
                  reason: {
                    kind: "short",
                    icon: "Es",
                    held: Math.floor(essence),
                    need: chosen.node.essence,
                    wait: secondsUntilHeld(
                      essence,
                      chosen.node.essence,
                      realmPerHour(setup.store, realm.entity_id, ResourcesIds.Essence, tick),
                    ),
                  },
                  step: (
                    <Button
                      role="primary"
                      icon="Mp"
                      word={MAP}
                      className="w-[104px]"
                      onClick={() => {
                        setOpen(null);
                        goToPlace(true);
                      }}
                    />
                  ),
                }
              : undefined
          }
          sending={sending}
          onResearch={() => void research(chosen.view)}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
};

/** The castle rows as the tree draws them: shrine and well, then the three reaches, each with what it gives. */
const castleNodes = (
  plan: NonNullable<ReturnType<typeof useResearchPlan>>,
): { node: CastleNode; view: ResearchNodeView; gives: ReactNode }[] => {
  const entries: { view: ResearchNodeView | undefined; icon: IconCode; label: string; gives: ReactNode }[] = [
    // A shrine's fixed XP is read from the preset with the contracts' progression rules.
    {
      view: siteNode(plan, "Shrine"),
      icon: "Sh",
      label: SHRINE,
      gives: <Chip icons={["Sh"]} label={XP} value="—" unit={XP} />,
    },
    {
      view: siteNode(plan, "Well"),
      icon: "Wl",
      label: WELL,
      gives: <Chip icons={["St"]} label={STAMINA} value={`+${nativeRuleConstants.WELL_STAMINA}`} />,
    },
    ...([1, 2, 3] as const).map((depth) => ({
      view: depthNode(plan, depth),
      icon: "Dp" as IconCode,
      label: REACH_NUMERALS[depth - 1],
      gives: (
        <Chip icons={["Dp"]} label={`${ETHEREAL} ${REACH_NUMERALS[depth - 1]}`} value={REACH_NUMERALS[depth - 1]} />
      ),
    })),
  ];
  return entries.flatMap(({ view, icon, label, gives }) =>
    view
      ? [{ node: { key: String(view.node), icon, label, essence: view.price, state: view.state }, view, gives }]
      : [],
  );
};
