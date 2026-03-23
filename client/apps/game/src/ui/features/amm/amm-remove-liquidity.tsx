import { Button } from "@/ui/design-system/atoms";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { useAmm } from "@/hooks/use-amm";
import { useCallback, useMemo, useState } from "react";
import { parseTokenAmount, formatTokenAmount, computeLpBurn, type Pool } from "@bibliothecadao/amm-sdk";

const MOCK_POOL: Pool = {
  tokenAddress: "0x2",
  lpTokenAddress: "0x100",
  lordsReserve: 1000000000000000000000n,
  tokenReserve: 5000000000000000000000n,
  totalLpSupply: 2000000000000000000000n,
  feeNum: 3n,
  feeDenom: 1000n,
  protocolFeeNum: 1n,
  protocolFeeDenom: 1000n,
};

export const AmmRemoveLiquidity = () => {
  const { client, executeSwap } = useAmm();

  const [lpAmount, setLpAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const pool = MOCK_POOL;

  const burnResult = useMemo(() => {
    if (lpAmount <= 0) return null;
    try {
      const lpBigint = parseTokenAmount(lpAmount.toString());
      return computeLpBurn(lpBigint, pool.lordsReserve, pool.tokenReserve, pool.totalLpSupply);
    } catch {
      return null;
    }
  }, [lpAmount, pool]);

  const handleRemove = useCallback(async () => {
    if (lpAmount <= 0 || !burnResult) return;
    setIsLoading(true);
    try {
      const lpBigint = parseTokenAmount(lpAmount.toString());
      const lordsMin = (burnResult.lordsOut * 95n) / 100n;
      const tokenMin = (burnResult.tokenOut * 95n) / 100n;

      const call = client.liquidity.removeLiquidity({
        ammAddress: client.ammAddress,
        tokenAddress: pool.tokenAddress,
        lpAmount: lpBigint,
        lordsMin,
        tokenMin,
      });

      await executeSwap(call);
      setLpAmount(0);
    } finally {
      setIsLoading(false);
    }
  }, [lpAmount, burnResult, pool, client, executeSwap]);

  const canRemove = lpAmount > 0 && burnResult !== null;

  return (
    <div className="space-y-3 mt-6">
      <h3 className="text-sm font-bold text-gold">Remove Liquidity</h3>

      <div className="bg-gold/10 rounded-xl p-3">
        <div className="text-xs text-gold/60 mb-1">LP Tokens</div>
        <NumberInput value={lpAmount} onChange={setLpAmount} arrows={false} allowDecimals />
      </div>

      {burnResult && (
        <div className="bg-gold/10 rounded-xl p-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gold/60">LORDS to Receive</span>
            <span className="text-gold">{formatTokenAmount(burnResult.lordsOut)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gold/60">Token to Receive</span>
            <span className="text-gold">{formatTokenAmount(burnResult.tokenOut)}</span>
          </div>
        </div>
      )}

      <Button variant="gold" className="w-full" disabled={!canRemove} onClick={handleRemove} isLoading={isLoading}>
        {canRemove ? "Remove Liquidity" : "Enter LP amount"}
      </Button>
    </div>
  );
};
