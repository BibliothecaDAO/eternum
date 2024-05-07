import { useMemo, useState, useCallback } from "react";
import { useDojo } from "@/hooks/context/DojoContext";
import { MarketManager } from "@/dojo/modelManager/MarketManager";
import { resources } from "@bibliothecadao/eternum";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import Button from "@/ui/elements/Button";
import { divideByPrecision, getEntityIdFromKeys } from "@/ui/utils/utils";
import { useComponentValue } from "@dojoengine/react";

type LiquidityResourceRowProps = {
  bankEntityId: bigint;
  bankAccountEntityId: bigint;
  resourceId: number;
};

export const LiquidityResourceRow = ({ bankEntityId, resourceId }: LiquidityResourceRowProps) => {
  const dojoContext = useDojo();
  const [isLoading, setIsLoading] = useState(false);

  const marketEntityId = useMemo(
    () => getEntityIdFromKeys([bankEntityId, BigInt(resourceId)]),
    [bankEntityId, resourceId],
  );
  const liquidityEntityId = useMemo(
    () => getEntityIdFromKeys([bankEntityId, BigInt(dojoContext.account.account.address), BigInt(resourceId)]),
    [bankEntityId, resourceId],
  );

  const market = useComponentValue(dojoContext.setup.components.Market, marketEntityId);
  const liquidity = useComponentValue(dojoContext.setup.components.Liquidity, liquidityEntityId);

  const marketManager = useMemo(
    () =>
      new MarketManager(
        dojoContext.setup.components.Market,
        dojoContext.setup.components.Liquidity,
        bankEntityId,
        BigInt(dojoContext.account.account.address),
        BigInt(resourceId),
      ),
    [dojoContext, bankEntityId, resourceId, market, liquidity],
  );

  const resource = useMemo(() => resources.find((r) => r.id === resourceId), [resourceId]);

  const pair = useMemo(
    () => (
      <div className="flex flex-row">
        {resource?.trait && <ResourceIcon resource={resource.trait} size="xs" className="mr-2" />}
        <>$LORDS/{resource?.ticker}</>
      </div>
    ),
    [resource],
  );

  const [totalLords, totalResource] = marketManager.getReserves();
  const [lordsAmount, resourceAmount] = marketManager.getMyLP();

  const myLiquidity = marketManager.getLiquidity();
  const canWithdraw = useMemo(
    () => (myLiquidity?.shares.mag || 0) > 0 && (totalLords > 0 || totalResource > 0),
    [myLiquidity, totalLords, totalResource],
  );

  const onWithdraw = useCallback(() => {
    setIsLoading(true);
    const sharesUnscaled = marketManager.getSharesUnscaled();
    const totalLiquidityUnscaled = marketManager.getTotalLiquidityUnscaled();
    const withdrawShares = sharesUnscaled > totalLiquidityUnscaled ? totalLiquidityUnscaled : sharesUnscaled;
    dojoContext.setup.systemCalls
      .remove_liquidity({
        bank_entity_id: bankEntityId,
        resource_type: BigInt(resourceId),
        shares: withdrawShares,
        signer: dojoContext.account.account,
      })
      .finally(() => setIsLoading(false));
  }, [dojoContext, bankEntityId, resourceId, marketManager]);

  return (
    <tr className="hover:bg-gray-100">
      <td>{pair}</td>
      <td>{divideByPrecision(totalLords).toFixed(2)}</td>
      <td>{divideByPrecision(totalResource).toFixed(2)}</td>
      <td>{divideByPrecision(lordsAmount).toFixed(2)}</td>
      <td>{divideByPrecision(resourceAmount).toFixed(2)}</td>
      <td>
        <Button onClick={onWithdraw} isLoading={isLoading} disabled={!canWithdraw}>
          Withdraw
        </Button>
      </td>
    </tr>
  );
};
