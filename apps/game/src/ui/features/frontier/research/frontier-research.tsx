import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { ETHEREAL, MAP, REACH_NUMERALS, SHRINE, STAMINA, WELL, XP } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { knownBalance } from "@/ui/utils/utils";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { type ExpeditionRules, getBalance } from "@bibliothecadao/eternum";
import {
  nativeResearchConstants as research,
  nativeRuleConstants,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";
import type { Account } from "starknet";

import { useGoToFrontierPlace } from "../frontier-home";
import { realmPerHour, secondsUntilHeld } from "../hud/army-order";
import { buildingIcon, buildingName } from "../build/building-names";
import { depthNode, type ResearchNodeView, siteNode, type TypeRowView } from "./research-plan";
import { useResearchPlan } from "./research-reader";
import { sidesTaken } from "./sides-taken";
import { type CastleNode, CastleNodeSheet, TreePage, type TreeRow } from "./tree-page";
import { TypeUpgrade } from "./type-upgrade";

/**
 * The castle's tree over the game's facts, a nav page: a row per building type that stands (its tier, the sides taken,
 * the next tier's Essence and labor), each opening its Upgrade sheet, then the castle rows (shrine, well and the three
 * reaches), each opening its sheet with Research.
 */
export const FrontierResearch = ({ rules, realm }: { rules: ExpeditionRules; realm: NativeRows["Structure"] }) => {
  const { setup, account } = useGame();
  const tick = useCurrentDefaultTick();
  const plan = useResearchPlan(realm);
  const goToPlace = useGoToFrontierPlace(realm);
  const [open, setOpen] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const typeRow = plan?.types.find(({ row }) => row === openRow);
  const [sending, setSending] = useState(false);
  const shrineXp = setup.store.get("ArmyProgressionRules", { game_id: realm.game_id })?.fixed_xp;
  const castle = plan ? castleNodes(plan, shrineXp) : [];
  const labor = knownBalance(getBalance(realm.entity_id, ResourcesIds.Labor, tick, setup.store).balance);
  const chosen = castle.find((node) => node.node.key === open);

  const research = async (node: ResearchNodeView) => {
    setSending(true);
    try {
      await setup.systemCalls.research({
        signer: account.account as unknown as Account,
        structureId: realm.entity_id,
        row: node.row,
        // The sheet offers no choice yet: a tier takes its first side (Fields, Tools, Drill, camps).
        choice: 0,
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
        rows={plan ? plan.types.map(treeRow) : []}
        chosen={openRow === null ? undefined : String(openRow)}
        castle={castle.map(({ node }) => node)}
        onRow={(key) => setOpenRow(Number(key))}
        onCastle={setOpen}
      />
      {typeRow && (
        <TypeUpgrade realm={realm} rules={rules} view={typeRow} essence={essence} onClose={() => setOpenRow(null)} />
      )}
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

/** A building type's row as the tree draws it: its tier, the sides taken, the next price and whether it is a choice. */
const treeRow = (view: TypeRowView): TreeRow => ({
  key: String(view.row),
  icon: buildingIcon(view.category),
  name: buildingName(view.category),
  tier: (view.tier + 1) as Tier,
  sides: sidesTaken(view.learned, view.row),
  next: view.next,
  choice: CHOOSING_ROWS.has(view.row),
});

/** The rows whose every tier is a final choice: two sides, or the Scouts' lodge's kind. */
const CHOOSING_ROWS = new Set<number>([
  research.ROW_FARM,
  research.ROW_WORKSHOP,
  research.ROW_BARRACKS,
  research.ROW_SCOUTS_LODGE,
]);

/** The castle rows as the tree draws them: shrine and well, then the three reaches, each with what it gives. */
const castleNodes = (
  plan: NonNullable<ReturnType<typeof useResearchPlan>>,
  shrineXp: number | undefined,
): { node: CastleNode; view: ResearchNodeView; gives: ReactNode }[] => {
  const entries: { view: ResearchNodeView | undefined; icon: IconCode; label: string; gives: ReactNode }[] = [
    {
      view: siteNode(plan, "Shrine"),
      icon: "Sh",
      label: SHRINE,
      gives: (
        <Chip icons={["Sh"]} label={XP} value={shrineXp === undefined ? "—" : `+${formatAmount(shrineXp)}`} unit={XP} />
      ),
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
