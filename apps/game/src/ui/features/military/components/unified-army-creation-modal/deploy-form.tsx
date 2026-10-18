import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudCost, HudDeploy, type HudTroopStack, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { TroopTier, type TroopType } from "@bibliothecadao/types";

import type { useArmyCreation } from "./use-army-creation";

type ArmyCreationForm = ReturnType<typeof useArmyCreation>;

const TIER_NUMBER = { [TroopTier.T1]: 1, [TroopTier.T2]: 2, [TroopTier.T3]: 3 } as const;
const stackKey = (type: TroopType, tier: TroopTier) => `${type}-${tier}`;

/**
 * The realm's troops on the deploy element: a column per troop, every tier in place, the chosen one pressed, and the
 * amount under them. A guard slot that holds troops takes only its own troop and tier, so the others are shut.
 */
export const DeployTroops = ({ form }: { form: ArmyCreationForm }) => {
  const locked =
    form.isDefenseTroopLocked && form.selectedGuardCategory !== undefined && form.selectedGuardTier !== undefined
      ? stackKey(form.selectedGuardCategory, form.selectedGuardTier)
      : null;
  const choices = form.troopOptions.flatMap((option) =>
    option.tiers.map((tier) => ({ key: stackKey(option.type, tier.tier), type: option.type, tier: tier.tier })),
  );
  return (
    <HudDeploy
      troops={form.troopOptions.map((option) => ({
        name: option.label,
        stacks: option.tiers.map(
          (tier): HudTroopStack => ({
            key: stackKey(option.type, tier.tier),
            icon: resourceMeaning(tier.resourceId),
            tier: TIER_NUMBER[tier.tier],
            held: tier.available,
            disabled: locked !== null && locked !== stackKey(option.type, tier.tier),
          }),
        ),
      }))}
      chosen={stackKey(form.selectedTroopCombo.type, form.selectedTroopCombo.tier)}
      onChoose={(key) => {
        const choice = choices.find((each) => each.key === key);
        if (choice) form.handleTroopSelect(choice.type, choice.tier);
      }}
      value={form.troopCount}
      most={form.maxAffordable}
      onChange={form.handleTroopCountChange}
    />
  );
};

/**
 * The one verb, in the window's foot: Deploy, carrying its verb only, and beside it what it costs and the one reason it
 * cannot go.
 */
export const DeployVerb = ({ form }: { form: ArmyCreationForm }) => (
  <HudWindowFoot
    note={
      <span className="flex flex-col items-start">
        <HudCost line={form.raiseLine} />
        <span role="status">{form.isActionDisabled ? form.blockedReason : null}</span>
      </span>
    }
  >
    <HudButton
      kind="primary"
      icon="military"
      disabled={form.isActionDisabled}
      busy={form.isLoading ? "Deploying…" : undefined}
      onClick={form.handleCreate}
    >
      Deploy
    </HudButton>
  </HudWindowFoot>
);
