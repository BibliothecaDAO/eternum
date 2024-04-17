import { useMemo } from "react";
import { useDojo } from "@/hooks/context/DojoContext";
import { MarketManager } from "@/dojo/modelManager/MarketManager";
import { resources } from "@bibliothecadao/eternum";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import Button from "@/ui/elements/Button";

export const LiquidityResourceRow = ({ bankEntityId, resourceId }: { bankEntityId: bigint; resourceId: number }) => {
  const {
    account: { account },
    setup: {
      components: { Market, Liquidity },
    },
  } = useDojo();

  const marketManager = useMemo(
    () => new MarketManager(Market, Liquidity, bankEntityId, BigInt(account.address), BigInt(resourceId)),
    [Market, Liquidity, bankEntityId, resourceId, account.address],
  );

  const [lordsAmount, resourceAmount] = marketManager.getMyLP();

  const resourceName = resources.find((r) => r.id === resourceId)?.trait;

  const pair = (
    <div className="flex flex-row">
      <ResourceIcon resource={"Lords"} size="xs" />
      {resourceName && <ResourceIcon resource={resourceName} size="xs" />}
      <>LORDS/${resourceName?.toUpperCase()}</>
    </div>
  );

  const [totalLords, totalResource] = marketManager.getReserves();

  const myLiquidity = marketManager.getLiquidity();

  const canWithdraw = (myLiquidity?.shares_mag || 0) > 0;

  return (
    <tr className="hover:bg-gray-100">
      <td>{pair}</td>
      <td>{totalLords}</td>
      <td>{totalResource}</td>
      <td>{lordsAmount}</td>
      <td>{resourceAmount}</td>
      <td>
        <Button onClick={() => {}} disabled={!canWithdraw}>
          Withdraw
        </Button>
      </td>
    </tr>
  );
};
