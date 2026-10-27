import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudCost, HudSheet, HudTier, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { costLine, type Price } from "@/ui/design-system/kit/price-faces";
import type { Fix, Refusal } from "@/ui/design-system/kit/refusal";
import {
  BUILDING_FIGURES,
  fromResearch,
  RESEARCH,
  RESEARCH_TREE,
  RESEARCHING,
  type Rank,
} from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { DestroyBuildingButton } from "@/ui/features/world/components/bottom-right-panel/destroy-building-button";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { researchRowOf } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatAmount, formatPercent, formatRate } from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";

import { buildingIcon, buildingName } from "../build/building-names";
import { buildingsMake, standingBuildings } from "../production/store-makers";
import { RefusedVerb } from "../refused-verb";
import { useResearchActions } from "../research/research-actions";
import { useResearchTree } from "../research/research-facts";
import { researchSideNode, firstMissing, type Need, needLine, type TreeNode } from "../research/research-tree";
import type { TappedBuilding } from "../research/selected-building";
import { CompareRows } from "./compare-rows";

/** What a building's card shows it makes: all of its type together, and why, said as a player thinks it. */
export type CardMakes = { icon: IconMeaning; rate: string; why?: string };

/**
 * A building tapped on the realm's board, as its own card (owner, 26 October: "when i click a building I should have the
 * same view as the castle"): what all of its type make now, its research now against its next tier, Research with its
 * price, and Delete. Its research opens on the Research page from a need on another node (the Barracks' gate).
 */
export const BuildingCard = ({
  realm,
  building,
  onResearchPage,
  onClose,
}: {
  realm: NativeRows["Structure"];
  building: TappedBuilding;
  onResearchPage: (node: string) => void;
  onClose: () => void;
}) => {
  const { setup } = useGame();
  useNativeRevision(["Building", "RealmKnowledge"]);
  const tree = useResearchTree(realm);
  const actions = useResearchActions(realm, onResearchPage);
  const demolish = useDemolish(realm, building);
  const row = researchRowOf(building.category);
  const node = tree?.nodes.find((each) => each.row === row && each.maxTier === 5);
  return (
    <BuildingCardView
      name={buildingName(building.category)}
      icon={buildingIcon(building.category)}
      standing={standingBuildings(setup.store, safeInteger(realm.entity_id), building.category)}
      makes={cardMakes(buildingsMake(setup.store, realm, building.category))}
      node={node}
      sending={node !== undefined && actions.sending(node)}
      fix={(need) => (node && tree ? actions.fixFor(need, node, tree.nodes) : undefined)}
      onResearch={(side) => node && actions.research(node, side)}
      demolish={
        <DestroyBuildingButton
          key={`${building.innerCol}:${building.innerRow}`}
          busy={demolish.busy}
          onDestroy={demolish.run}
        />
      }
      onClose={onClose}
    />
  );
};

/** Delete for the tapped building: the game refunds part of its cost; a refusal becomes a toast. */
const useDemolish = (realm: NativeRows["Structure"], building: TappedBuilding) => {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await requireActiveGameClient().actions.destroyBuilding({
        structureId: safeInteger(realm.entity_id),
        hex: { col: building.innerCol, row: building.innerRow },
      });
    } catch (error) {
      toast.failed(error, "The building could not be demolished.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
};

/** What all of the type make, as the card says it: one rate, research's share only as the why. */
const cardMakes = (makes: ReturnType<typeof buildingsMake>): CardMakes | undefined =>
  makes && {
    icon: resourceMeaning(makes.resource),
    rate: formatRate(makes.perSecond),
    why: makes.research && fromResearch(formatPercent(makes.research.share, { signed: true }), makes.research.side),
  };

/**
 * The card as drawn: its painting, how many stand and its tier, Delete; what they make; the research's figures now and
 * at the next tier, a side picked by its row; Research in the foot, or why it cannot run yet with its fix.
 */
export const BuildingCardView = ({
  name,
  icon,
  standing,
  makes,
  node,
  sending,
  fix,
  onResearch,
  demolish,
  onClose,
}: {
  name: string;
  icon: IconMeaning;
  standing: number;
  makes: CardMakes | undefined;
  /** The building's research row; undefined while the realm's research is unknown. */
  node: TreeNode | undefined;
  sending: boolean;
  fix: (need: Need) => Fix | undefined;
  onResearch: (side: number) => unknown;
  demolish: ReactNode;
  onClose: () => void;
}) => {
  const [side, setSide] = useState(0);
  const chosen = node && researchSideNode(node, side);
  const top = chosen?.state === "done";
  return (
    <HudSheet label={name} onClose={onClose}>
      <div data-building-card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Icon name={icon} size={56} />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
            <span className="text-hud-strong text-hud-ink">
              {formatAmount(standing)} {BUILDING_FIGURES.standing}
            </span>
            {node && <HudTier tier={tierOf(node.tier)} />}
          </div>
          {makes && (
            <span data-tip={makes.why} className="flex items-center gap-1.5 text-hud-title tabular-nums text-hud-ink">
              <Icon name={makes.icon} size={28} />
              {makes.rate}
            </span>
          )}
          {demolish}
        </div>
        {node && (
          <CompareRows
            now={<HudTier tier={tierOf(chosen!.tier)} />}
            next={chosen?.nextTier ? <HudTier tier={chosen.nextTier} /> : undefined}
            rows={node.figures.map((figure, index) => ({
              icon: figure.icon,
              word: figure.name,
              now: figure.now,
              next: figure.next,
              grows: node.sides ? index === side : true,
              onPick: node.sides ? () => setSide(index) : undefined,
            }))}
          />
        )}
        {node && !top && (
          <ResearchFoot
            node={chosen!}
            verb={node.sides?.[side] ? RESEARCH_TREE.research(node.sides[side].name) : RESEARCH}
            sending={sending}
            fix={fix}
            onResearch={() => onResearch(node.sides ? side : 0)}
          />
        )}
      </div>
    </HudSheet>
  );
};

/** A row's tiers learned (0 to 4) as the tier its gem shows (Common I to Legendary V). */
const tierOf = (tier: number) => Math.min(5, tier) as Rank;

/** The next tier's Research in the card's foot, with its price; or, while it cannot run, why, with the fix. */
const ResearchFoot = ({
  node,
  verb,
  sending,
  fix,
  onResearch,
}: {
  node: TreeNode;
  verb: string;
  sending: boolean;
  fix: (need: Need) => Fix | undefined;
  onResearch: () => void;
}) => {
  const missing = firstMissing(node);
  if (missing) return <RefusedVerb word={verb} refusal={refusalOf(missing, fix(missing))} />;
  const prices: Price[] = node.needs.filter(isPrice).map((need) => ({ of: need.kind, amount: need.need }));
  return (
    <HudWindowFoot note={<HudCost line={costLine(prices)} />}>
      <HudButton kind="primary" busy={sending ? RESEARCHING : undefined} onClick={onResearch}>
        {verb}
      </HudButton>
    </HudWindowFoot>
  );
};

/** A need that is the next tier's price: the Essence or the labor it costs. */
const isPrice = (need: Need): need is Extract<Need, { kind: "essence" | "labor" }> =>
  need.kind === "essence" || need.kind === "labor";

/** The first unmet need as the foot says it: a price held short of, with its wait unknown; else the need's own line. */
const refusalOf = (need: Need, fix: Fix | undefined): Refusal => ({
  reason: isPrice(need)
    ? { kind: "short", of: need.kind, held: Math.floor(need.have), need: need.need }
    : { kind: "failed", line: needLine(need) },
  fix,
});
