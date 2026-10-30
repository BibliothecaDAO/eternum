import { useArmyOrder } from "@/ui/features/frontier/hud/army-order";
import { useLayout } from "@/shell/frame/layout";
import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { openOnMap } from "@/play/navigation/open-place";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import type { NextStep } from "@/ui/features/world/hud/next-step";
import { NextUpView } from "@/ui/features/world/hud/next-up";
import { useActNowRefusal } from "@/utils/can-issue-orders";
import { Position } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";

import { type useExpeditionRules, useGoToFrontierPlace } from "../frontier-home";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import type { HudSurface } from "../hud/frontier-nav";
import { type FrontierCoachAct, type FrontierCoachStep } from "./frontier-coach";
import type { NextUpFacts } from "./next-up-facts";
import { useNextUpSteps } from "./next-up-steps";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

/**
 * Frontier's Next up, in the unified HUD's Next up place (the rail's top on a desktop; on a phone one line under the
 * strip, a tap from its full step): the step the player's day calls for now, with its one button, and the rest a page away (frontierCoachSteps).
 * It speaks to a player in their own realm; a visit or a spectator has none. Settings' Tips off leaves the alerts.
 */
export const FrontierNextUp = ({
  rules,
  realm,
  onSurface,
  onOpenArmy,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  onSurface: (surface: HudSurface) => void;
  /** Picks an army and opens its panel. */
  onOpenArmy: (explorerId: number) => void;
}) => {
  const { facts, steps } = useNextUpSteps(rules, realm);
  const take = useTakeStep(realm, facts, onSurface, onOpenArmy);
  // A phone's pinned order draws its own bar with its verb: that is the action at hand.
  const order = useArmyOrder();
  const layout = useLayout();
  const orderPinned = order !== null && layout === "phone";
  return (
    <NextUpView
      steps={steps.map((step) => toNextStep(step, take))}
      refusal={useActNowRefusal()}
      yields={orderPinned}
      compact={layout === "phone"}
    />
  );
};

const toNextStep = (step: FrontierCoachStep, take: (act: FrontierCoachAct) => void): NextStep => ({
  key: step.key,
  kind: "order",
  line: step.line,
  verb: step.verb,
  busy: false,
  run: step.act ? () => take(step.act!) : null,
});

/**
 * What a step's button does: open the realm's board, Deploy from the realm, select the readiest army on the map (or
 * the one whose XP buys a tier, with its sheet open), centre the map on today's camp with its tile picked, or open
 * Research.
 */
const useTakeStep = (
  realm: NativeRows["Structure"],
  facts: NextUpFacts,
  onSurface: (surface: HudSurface) => void,
  onOpenArmy: (explorerId: number) => void,
) => {
  const goToPlace = useGoToFrontierPlace(realm);
  const armies = useDockArmies(realm);
  const selectArmy = useSelectArmyOnMap();
  return (act: FrontierCoachAct) => {
    switch (act) {
      case "realm":
        return goToPlace(false);
      case "deploy":
        return openArmyDeployment({ structureId: safeInteger(realm.entity_id), isExplorer: true });
      case "select-army": {
        const readiest = readiestArmy(armies);
        return readiest && selectArmy(readiest.explorerId);
      }
      case "army": {
        const tiered = armies.find((army) => army.canSpendSkillPoint);
        return tiered && onOpenArmy(tiered.explorerId);
      }
      case "camp":
        return facts.camp && openOnMap(Position.fromContract(facts.camp), "tile");
      case "research":
        return onSurface("research");
    }
  };
};

/** The army with the most stamina left: the one that can act. */
const readiestArmy = (armies: readonly DockArmy[]): DockArmy | undefined =>
  armies.toSorted((left, right) => (right.stamina?.current ?? 0) - (left.stamina?.current ?? 0))[0];
