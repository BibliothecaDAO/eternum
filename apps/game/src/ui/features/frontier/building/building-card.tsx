import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudCost, HudSheet, HudTier, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { costLine, type Price } from "@/ui/design-system/kit/price-faces";
import type { Fix, Refusal } from "@/ui/design-system/kit/refusal";
import { BUILDING_FIGURES, RESEARCH, RESEARCH_TREE, RESEARCHING, type Rank } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { DestroyBuildingButton } from "@/ui/features/world/components/bottom-right-panel/destroy-building-button";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { researchRowOf } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatRate } from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";

import { buildingIcon, buildingName } from "../build/building-names";
import { buildingsMake, standingBuildings } from "../production/store-makers";
import { RefusedVerb } from "../refused-verb";
import { useResearchActions } from "../research/research-actions";
import { useResearchTree } from "../research/research-facts";
import { researchSideNode, firstMissing, type Need, needLine, type TreeNode } from "../research/research-tree";
import type { TappedBuilding } from "../research/selected-building";
import { CompareRows } from "./compare-rows";

/** What a building's card shows it makes: all of its type together; its research shows as the card's gems. */
export type CardMakes = { icon: IconMeaning; rate: string };

/**
 * A building tapped on the realm's board, as its own card (owner, 26 October: "when i click a building I should have the
 * same view as the castle"): what all of its type make now and its research's tier. A player's own building adds its
 * next tier, Research with its price, and Delete; its research opens on the Research page from a need on another node
 * (the Barracks' gate). A viewer reads what the building is and does, and nothing the viewer would pay or order.
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
  const ordersAllowed = useUIStore(canIssueOrders);
  const tree = useResearchTree(realm);
  const actions = useResearchActions(realm, onResearchPage);
  const demolish = useDemolish(realm, building);
  const row = researchRowOf(building.category);
  const node = tree?.nodes.find((each) => each.row === row && each.maxTier === 5);
  const orders: BuildingOrders = {
    sending: node !== undefined && actions.sending(node),
    fix: (need) => (node && tree ? actions.fixFor(need, node, tree.nodes) : undefined),
    onResearch: (side) => node && actions.research(node, side),
    demolish: (
      <DestroyBuildingButton
        key={`${building.innerCol}:${building.innerRow}`}
        busy={demolish.busy}
        onDestroy={demolish.run}
      />
    ),
  };
  return (
    <BuildingCardView
      name={buildingName(building.category)}
      icon={buildingIcon(building.category)}
      standing={standingBuildings(setup.store, safeInteger(realm.entity_id), building.category)}
      makes={cardMakes(buildingsMake(setup.store, realm, building.category))}
      node={node}
      orders={ordersAllowed ? orders : undefined}
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

/** What all of the type make, as the card says it: one rate. */
const cardMakes = (makes: ReturnType<typeof buildingsMake>): CardMakes | undefined =>
  makes && { icon: resourceMeaning(makes.resource), rate: formatRate(makes.perSecond) };

/** What a player's own building's card orders: its next tier's Research (or what it needs, with the fix) and Delete. */
type BuildingOrders = {
  sending: boolean;
  fix: (need: Need) => Fix | undefined;
  onResearch: (side: number) => unknown;
  demolish: ReactNode;
};

/**
 * The card as drawn: its painting, how many stand and its tier; what they make; the research's figures now. With the
 * player's orders, Delete, the figures at the next tier with a side picked by its row, and Research in the foot, or why
 * it cannot run yet with its fix.
 */
export const BuildingCardView = ({
  name,
  icon,
  standing,
  makes,
  node,
  orders,
  onClose,
}: {
  name: string;
  icon: IconMeaning;
  standing: number;
  makes: CardMakes | undefined;
  /** The building's research row; undefined while the realm's research is unknown. */
  node: TreeNode | undefined;
  /** Undefined for a viewer: the card then reads the building as it stands. */
  orders?: BuildingOrders;
  onClose: () => void;
}) => {
  const [side, setSide] = useState(0);
  const chosen = node && researchSideNode(node, side);
  const next = orders && chosen && chosen.state !== "done" ? chosen : undefined;
  return (
    <HudSheet label={name} onClose={onClose}>
      <div data-building-card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {/* The type's tier as a badge on its painting's corner (owner, 27 October: "the III as a badge to the barracks
              icon would work better"). */}
          <span data-badged className="relative shrink-0">
            <Icon name={icon} size={56} />
            {node && (
              <span className="absolute -bottom-1 -right-1">
                <HudTier tier={tierOf(node.tier)} />
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1 text-hud-strong text-hud-ink">{BUILDING_FIGURES.standing(standing)}</span>
          {makes && (
            <span className="flex items-center gap-1.5 text-hud-title tabular-nums text-hud-ink">
              <Icon name={makes.icon} size={28} />
              {makes.rate}
            </span>
          )}
          {orders?.demolish}
        </div>
        {node && (
          <CompareRows
            now={<HudTier tier={tierOf(chosen!.tier)} />}
            next={next?.nextTier ? <HudTier tier={next.nextTier} /> : undefined}
            rows={node.figures.map((figure, index) => ({
              icon: figure.icon,
              word: figure.name,
              now: figure.now,
              next: orders && figure.next,
              grows: orders !== undefined && (!node.sides || index === side),
              onPick: orders && node.sides ? () => setSide(index) : undefined,
            }))}
          />
        )}
        {next && orders && (
          <ResearchFoot
            node={next}
            verb={next.sides?.[side] ? RESEARCH_TREE.research(next.sides[side].name) : RESEARCH}
            sending={orders.sending}
            fix={orders.fix}
            onResearch={() => orders.onResearch(next.sides ? side : 0)}
          />
        )}
      </div>
    </HudSheet>
  );
};

/** A row's research rank, from untrained 0 through Legendary V. */
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
