import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/elements/button";
import { LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has } from "@dojoengine/recs";
import { useMemo, useState } from "react";

interface RegisterPointsButtonProps {
  className?: string;
}

export const RegisterPointsButton = ({ className }: RegisterPointsButtonProps) => {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { claim_share_points },
    },
  } = useDojo();

  const [isSharePointsLoading, setIsSharePointsLoading] = useState(false);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const hyperstructure_entities = useEntityQuery([Has(components.Hyperstructure)]);

  const { registeredPoints, unregisteredShareholderPoints } = useMemo(() => {
    const leaderboardManager = LeaderboardManager.instance(components);
    return {
      registeredPoints: leaderboardManager.getPlayerRegisteredPoints(ContractAddress(account.address)),
      unregisteredShareholderPoints: leaderboardManager.getPlayerHyperstructureUnregisteredShareholderPoints(
        ContractAddress(account.address),
      ),
    };
  }, [components, account.address]);

  const hyperstructuresEntityIds = useMemo(() => {
    return hyperstructure_entities
      .map((entity) => getComponentValue(components.Hyperstructure, entity)?.hyperstructure_id)
      .filter((id) => id !== undefined);
  }, [hyperstructure_entities]);

  const hasUnregisteredPoints = unregisteredShareholderPoints > 0;
  const totalPoints = registeredPoints + unregisteredShareholderPoints;

  const claimSharePoints = async () => {
    if (!hasUnregisteredPoints) return;

    setIsSharePointsLoading(true);
    try {
      await claim_share_points({
        signer: account,
        hyperstructure_ids: hyperstructuresEntityIds,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSharePointsLoading(false);
    }
  };

  return (
    <Button
      variant={hasUnregisteredPoints ? "primary" : "outline"}
      isLoading={isSharePointsLoading}
      disabled={!hasUnregisteredPoints}
      className={`${className} ${!hasUnregisteredPoints ? "opacity-75" : ""}`}
      onMouseOver={() => {
        setTooltip({
          position: "bottom",
          content: (
            <div className="flex flex-col whitespace-nowrap pointer-events-none text-center">
              <span className="font-bold text-gold mb-1">Points Summary</span>
              <span className="flex justify-between gap-4">
                <span>Registered:</span>
                <span className="text-green-400">{registeredPoints.toLocaleString()}</span>
              </span>
              <span className="flex justify-between gap-4">
                <span>Unregistered:</span>
                <span className={unregisteredShareholderPoints > 0 ? "text-yellow-400" : "text-gray-400"}>
                  {unregisteredShareholderPoints.toLocaleString()}
                </span>
              </span>
              <div className="border-t border-gray-600 mt-1 pt-1">
                <span className="flex justify-between gap-4 font-semibold">
                  <span>Total:</span>
                  <span className="text-gold">{totalPoints.toLocaleString()}</span>
                </span>
              </div>
              {!hasUnregisteredPoints && <span className="text-gray-400 text-xs mt-1">No points to register</span>}
              {hasUnregisteredPoints && (
                <span className="text-yellow-400 text-xs mt-1">Click to register unregistered points</span>
              )}
            </div>
          ),
        });
      }}
      onMouseOut={() => {
        setTooltip(null);
      }}
      onClick={claimSharePoints}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">
          <span className="text-green-400">{registeredPoints.toLocaleString()}</span>
          <span className="text-gray-500 mx-1">|</span>
          <span className={unregisteredShareholderPoints > 0 ? "text-yellow-400" : "text-gray-400"}>
            {unregisteredShareholderPoints.toLocaleString()}
          </span>
        </span>
        {hasUnregisteredPoints && <span className="text-yellow-400 text-sm animate-pulse">Register</span>}
        {!hasUnregisteredPoints && <span className="text-gray-400 text-sm">Points</span>}
      </div>
    </Button>
  );
};
