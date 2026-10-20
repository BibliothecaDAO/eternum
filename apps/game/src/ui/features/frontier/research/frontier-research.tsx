import { type IconMeaning } from "@/ui/design-system/icon";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useAllInFlight } from "@/hooks/store/use-actions-in-flight";
import { HudChip } from "@/ui/design-system/kit/hud-elements";

import type { Tier } from "@/ui/design-system/kit/tier-chip";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import {
  armiesEnter,
  armiesFind,
  ETHEREAL,
  needsFirst,
  REACH_NUMERALS,
  SHRINE,
  STAMINA,
  WELL,
  XP,
} from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { knownAmount } from "@/ui/utils/utils";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { type ExpeditionRules, getBalance } from "@bibliothecadao/eternum";
import {
  safeInteger,
  nativeResearchConstants as research,
  nativeRuleConstants,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { ResourcesIds, formatAmount } from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";

import { reachMark } from "../depth-art";
import { useGoToFrontierPlace } from "../frontier-home";
import { exploreFix } from "../frontier-reveal-yield";
import { realmPerHour, secondsUntilHeld } from "../hud/army-order";
import { buildingIcon, buildingName } from "../build/building-names";
import { depthNode, type ResearchNodeView, siteNode, type TypeRowView } from "./research-plan";
import { useResearchPlan } from "./research-reader";
import { sidesTaken } from "./sides-taken";
import { researchKey, sendResearch } from "./send-research";
import { type CastleNode, CastleNodeSheet, TreePage, type TreeRow } from "./tree-page";
import { TypeUpgrade, typeRowLine } from "./type-upgrade";

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
  const researching = useAllInFlight("research");
  const isResearching = (row: number) => researching.has(researchKey(realm, row));
  const shrineXp = setup.store.get("ArmyProgressionRules", { game_id: realm.game_id })?.fixed_xp;
  const castle = plan ? castleNodes(plan, shrineXp) : [];
  const labor = knownAmount(getBalance(safeInteger(realm.entity_id), ResourcesIds.Labor, tick, setup.store).balance);
  const chosen = castle.find((node) => node.node.key === open);

  const research = async (node: ResearchNodeView) => {
    try {
      // The sheet offers no choice yet: a tier takes its first side (Fields, Tools, Drill, camps).
      await sendResearch(setup.systemCalls, account.account, realm, { row: node.row, choice: 0 }, () => setOpen(null));
    } catch (error) {
      toast.failed(error, "The research could not be sent.");
    }
  };

  const essence = plan?.essence;
  /** Why a castle row cannot be researched now: the row before it, or the Essence it needs against what is held. */
  const nodeRefusal = ({ node, waitsFor }: (typeof castle)[number]): Refusal | undefined => {
    if (node.state === "locked") return { reason: { kind: "failed", line: needsFirst(waitsFor ?? "") } };
    if (essence === undefined || essence >= node.essence) return undefined;
    return {
      reason: {
        kind: "short",
        of: "essence",
        held: Math.floor(essence),
        need: node.essence,
        wait: secondsUntilHeld(
          essence,
          node.essence,
          realmPerHour(setup.store, safeInteger(realm.entity_id), ResourcesIds.Essence, tick),
        ),
      },
      fix: exploreFix(ResourcesIds.Essence, () => {
        setOpen(null);
        goToPlace(true);
      }),
    };
  };
  return (
    <>
      <TreePage
        essence={essence === undefined ? undefined : Math.floor(essence)}
        labor={labor === undefined ? undefined : Math.floor(labor)}
        rows={
          plan
            ? plan.types.map((view) => ({
                ...treeRow(view, typeRowLine(setup.store, realm, view)),
                researching: isResearching(view.row),
              }))
            : []
        }
        chosen={openRow === null ? undefined : String(openRow)}
        castle={castle.map(({ node, view }) => ({ ...node, researching: isResearching(view.row) }))}
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
          refusal={nodeRefusal(chosen)}
          sending={isResearching(chosen.view.row)}
          onResearch={() => void research(chosen.view)}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
};

/** A building type's row as the tree draws it: its tier, the sides taken, the next price and whether it is a choice. */
const treeRow = (view: TypeRowView, tip: string): TreeRow => ({
  key: String(view.row),
  icon: buildingIcon(view.category),
  name: buildingName(view.category),
  tip,
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

/**
 * The castle rows as the tree draws them: shrine and well, then the three reaches, each with what it gives, what
 * researching it opens (the contract finds a realm's armies Shrines and Wells, and lets them into a reach, only once
 * its row is learned), and the reach that comes before it.
 */
const castleNodes = (
  plan: NonNullable<ReturnType<typeof useResearchPlan>>,
  shrineXp: number | undefined,
): { node: CastleNode; view: ResearchNodeView; gives: ReactNode; waitsFor?: string }[] => {
  const reach = (depth: 1 | 2 | 3) => `${ETHEREAL} ${REACH_NUMERALS[depth - 1]}`;
  const entries: {
    view: ResearchNodeView | undefined;
    icon: IconMeaning;
    label: string;
    tip: string;
    gives: ReactNode;
    waitsFor?: string;
  }[] = [
    {
      view: siteNode(plan, "Shrine"),
      icon: "shrine",
      label: SHRINE,
      tip: armiesFind(SHRINE, `+${formatAmount(shrineXp)} ${XP}`),
      gives: (
        <HudChip icons={["shrine"]} label={XP}>
          {`${shrineXp === undefined ? "—" : `+${formatAmount(shrineXp)}`} ${XP}`}
        </HudChip>
      ),
    },
    {
      view: siteNode(plan, "Well"),
      icon: "well",
      label: WELL,
      tip: armiesFind(WELL, `+${nativeRuleConstants.WELL_STAMINA} ${STAMINA}`),
      gives: (
        <HudChip icons={["stamina"]} label={STAMINA}>
          {`+${nativeRuleConstants.WELL_STAMINA}`}
        </HudChip>
      ),
    },
    ...([1, 2, 3] as const).map((depth) => ({
      view: depthNode(plan, depth),
      icon: reachMark(depth),
      label: REACH_NUMERALS[depth - 1],
      tip: armiesEnter(reach(depth)),
      waitsFor: depth === 1 ? undefined : reach((depth - 1) as 1 | 2),
      gives: (
        <HudChip icons={[reachMark(depth)]} label={`${ETHEREAL} ${REACH_NUMERALS[depth - 1]}`}>
          {REACH_NUMERALS[depth - 1]}
        </HudChip>
      ),
    })),
  ];
  return entries.flatMap(({ view, icon, label, tip, gives, waitsFor }) =>
    view
      ? [
          {
            node: { key: String(view.node), icon, label, tip, essence: view.price, state: view.state },
            view,
            gives,
            waitsFor,
          },
        ]
      : [],
  );
};
