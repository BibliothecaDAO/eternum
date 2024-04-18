import { useMemo, useState } from "react";
import { useDojo } from "@/hooks/context/DojoContext";
import { MarketManager } from "@/dojo/modelManager/MarketManager";
import { resources } from "@bibliothecadao/eternum";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import Button from "@/ui/elements/Button";
import { divideByPrecision } from "@/ui/utils/utils";

export const LiquidityResourceRow = ({ bankEntityId, resourceId }: { bankEntityId: bigint; resourceId: number }) => {
  const {
    account: { account },
    setup: {
      components: { Market, Liquidity },
      systemCalls: { remove_liquidity },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const marketManager = useMemo(
    () => new MarketManager(Market, Liquidity, bankEntityId, BigInt(account.address), BigInt(resourceId)),
    [Market, Liquidity, bankEntityId, resourceId, account.address],
  );

  const [lordsAmount, resourceAmount] = marketManager.getMyLP();

  const resourceName = resources.find((r) => r.id === resourceId)?.trait;

  const pair = (
    <div className="flex flex-row">
      {resourceName && <ResourceIcon resource={resourceName} size="xs" />}
      <>LORDS/{resourceName?.toUpperCase()}</>
    </div>
  );

  const [totalLords, totalResource] = marketManager.getReserves();
  const myLiquidity = marketManager.getLiquidity();

  const canWithdraw = (myLiquidity?.shares.mag || 0) > 0 && (totalLords > 0 || totalResource > 0);

  const onWithdraw = () => {
    const sharesUnscaled = marketManager.getSharesUnscaled();
    const totalLiquidityUnscaled = marketManager.getTotalLiquidityUnscaled();
    const withdrawShares = BigInt(Math.min(Number(sharesUnscaled), Number(totalLiquidityUnscaled)));
    setIsLoading(true);
    remove_liquidity({
      bank_entity_id: bankEntityId,
      resource_type: BigInt(resourceId),
      shares: withdrawShares,
      signer: account,
    })
      .then(() => setIsLoading(false))
      .catch(() => setIsLoading(false));
  };

  return (
    <tr className="hover:bg-gray-100">
      <td>{pair}</td>
      <td>{divideByPrecision(totalLords).toFixed(0)}</td>
      <td>{divideByPrecision(totalResource).toFixed(0)}</td>
      <td>{divideByPrecision(lordsAmount).toFixed(0)}</td>
      <td>{divideByPrecision(resourceAmount).toFixed(0)}</td>
      <td>
        <Button onClick={onWithdraw} isLoading={isLoading} disabled={!canWithdraw}>
          Withdraw
        </Button>
      </td>
    </tr>
  );
};
