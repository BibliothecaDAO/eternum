import { HudButton, HudNumberField, HudSelect } from "@/ui/design-system/kit/hud-elements";
import { knownAmount } from "@/ui/utils/utils";
import { getBlockTimestamp, getBalance } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { ID, Resources, ResourcesIds, formatCharge, formatAmount, resourceName } from "@bibliothecadao/types";
import { memo } from "react";

/** One side of a bank trade: how much (typed, or all that is held), and of which resource. */
export const ResourceBar = memo(
  ({
    entityId,
    lordsFee,
    resources,
    resourceId,
    setResourceId,
    amount,
    setAmount,
    disableInput = false,
    max = Infinity,
  }: {
    entityId: ID;
    lordsFee: number;
    resources: Resources[];
    resourceId: ResourcesIds;
    setResourceId: (resourceId: ResourcesIds) => void;
    amount: number;
    setAmount: (amount: number) => void;
    disableInput?: boolean;
    max?: number;
  }) => {
    const game = useGame();
    useNativeRevision(["ResourceBalance", "ResourceProduction", "ResourceWeight", "Market", "Liquidity", "Structure"]);
    const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
    const balanceOf = (id: number) =>
      knownAmount(getBalance(entityId, id, currentDefaultTick, game.setup.store).balance);

    const selectedResourceBalance = balanceOf(Number(resourceId));
    const hasLordsFees = lordsFee > 0 && resourceId === ResourcesIds.Lords;
    const finalResourceBalance =
      selectedResourceBalance === undefined ? undefined : selectedResourceBalance - (hasLordsFees ? lordsFee : 0);
    const trait = resourceName(Number(resourceId));

    return (
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-hud-divider pb-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <HudNumberField label={`${trait} amount`} value={amount} onChange={setAmount} max={max} decimals />
          {!disableInput && (
            <span className="flex items-center gap-2 text-hud-label">
              <HudButton
                kind="quiet"
                size="sm"
                disabled={(finalResourceBalance ?? 0) <= 0}
                onClick={() => setAmount(finalResourceBalance ?? 0)}
              >
                Max: {selectedResourceBalance === undefined ? "—" : formatAmount(selectedResourceBalance)}
              </HudButton>
              {hasLordsFees && (
                <span className="text-hud-bad">{`[+${isNaN(lordsFee) ? "0" : formatCharge(lordsFee)}]`}</span>
              )}
            </span>
          )}
        </div>
        <span className="w-40">
          <HudSelect
            label="Resource"
            value={Number(resourceId) as ResourcesIds}
            disabled={resources.length <= 1}
            options={resources.map((resource) => ({
              value: resource.id as ResourcesIds,
              label: resourceName(resource.id),
              hint: formatAmount(balanceOf(resource.id)) ?? "—",
            }))}
            onChange={setResourceId}
          />
        </span>
      </div>
    );
  },
);
