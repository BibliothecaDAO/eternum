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
  entityId: bigint;
  resourceId: number;
};

export const LiquidityResourceRow = ({ bankEntityId, entityId, resourceId }: LiquidityResourceRowProps) => {
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
        <>
          <ResourceIcon resource={"Lords"} size="md" />
          {" / "}
          {resource?.trait && <ResourceIcon resource={resource.trait} size="md" />}
        </>
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
        entity_id: entityId,
        resource_type: BigInt(resourceId),
        shares: withdrawShares,
        signer: dojoContext.account.account,
      })
      .finally(() => setIsLoading(false));
  }, [dojoContext, bankEntityId, resourceId, marketManager]);

  return (
    <tr className="text-lg hover:bg-gold/20 my-1 border border-gold/10">
      <td>{pair}</td>
      <td>{divideByPrecision(totalLords).toLocaleString()}</td>
      <td>{divideByPrecision(totalResource).toLocaleString()}</td>
      <td>{divideByPrecision(lordsAmount).toLocaleString()}</td>
      <td>{divideByPrecision(resourceAmount).toLocaleString()}</td>
      <td>
        <Button variant="outline" onClick={onWithdraw} isLoading={isLoading} disabled={!canWithdraw}>
          Withdraw
        </Button>
      </td>
    </tr>
  );
};
