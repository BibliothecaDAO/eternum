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

  const canWithdraw = (myLiquidity?.shares.mag || 0) > 0;

  const sharesUnscaled = marketManager.getSharesUnscaled();

  const onWithdraw = () => {
    setIsLoading(true);
    remove_liquidity({
      bank_entity_id: bankEntityId,
      resource_type: BigInt(resourceId),
      shares: sharesUnscaled,
      signer: account,
    })
      .then(() => setIsLoading(false))
      .catch(() => setIsLoading(false));
  };

  return (
    <tr className="hover:bg-gray-100">
      <td>{pair}</td>
      <td>{divideByPrecision(totalLords)}</td>
      <td>{divideByPrecision(totalResource)}</td>
      <td>{divideByPrecision(lordsAmount)}</td>
      <td>{divideByPrecision(resourceAmount)}</td>
      <td>
        <Button onClick={onWithdraw} isLoading={isLoading} disabled={!canWithdraw}>
          Withdraw
        </Button>
      </td>
    </tr>
  );
};
