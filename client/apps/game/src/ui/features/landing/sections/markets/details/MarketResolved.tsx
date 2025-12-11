import { MarketClass } from "@/pm/class";
import { formatUint256 } from "@/pm/utils";
import { Button } from "@/ui/design-system/atoms";
import { HStack, VStack } from "@pm/ui";
import { TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { MaybeController } from "../MaybeController";

export function MarketResolved({
  market,
  ...props
}: {
  market: MarketClass;
} & React.ComponentProps<"div">) {
  const outcomes = market.getMarketTextOutcomes();

  const payouts = useMemo(() => {
    switch (market.typ.activeVariant()) {
      case "Binary":
        return [
          {
            index: 0,
            name: outcomes[0],
            payoutNumerator: Number(market.conditionResolution?.payout_numerators[0]),
          },
          {
            index: 1,
            name: outcomes[1],
            payoutNumerator: Number(market.conditionResolution?.payout_numerators[1]),
          },
        ];
      case "Categorical":
        return market.odds?.map((odds, idx) => {
          return {
            index: idx,
            name: outcomes[idx],
            payoutNumerator: Number(market.conditionResolution?.payout_numerators[idx]),
          };
        });
    }
    return [];
  }, [market]);

  if (!market || !payouts || !market.odds) return null;

  return (
    <div {...props}>
      {market.typBinary() && !market.typBinaryScalar() && (
        <HStack className="justify-center gap-3">
          {payouts[0].payoutNumerator > 0 && (
            <>
              <Button className="bg-progress-bar-good text-white hover:bg-progress-bar-good/80">YES</Button>
              <HStack className="text-brilliance">
                <TrendingUp />
                {Math.ceil((Number(market.odds[1]) / Number(market.odds[0])) * 100)}%
              </HStack>
            </>
          )}
          {payouts[1].payoutNumerator > 0 && (
            <>
              <Button className="bg-danger text-lightest hover:bg-danger/80">NO</Button>
              <HStack className="text-brilliance">
                <TrendingUp />
                {Math.ceil((Number(market.odds[0]) / Number(market.odds[1])) * 100)}%
              </HStack>
            </>
          )}
        </HStack>
      )}

      {market.typBinary() && market.typBinaryScalar() && (
        <HStack className="justify-center gap-3">
          {payouts[0].payoutNumerator > 0 &&
            payouts[1].payoutNumerator === 0 &&
            `< ${formatUint256(market.typBinaryScalar().low, 18)}`}
          {payouts[1].payoutNumerator > 0 &&
            payouts[0].payoutNumerator === 0 &&
            `< ${formatUint256(market.typBinaryScalar().high, 18)}`}
          {payouts[0].payoutNumerator > 0 &&
            payouts[1].payoutNumerator > 0 &&
            `${
              (BigInt(market.typBinaryScalar().low) +
                ((BigInt(market.typBinaryScalar().high) - BigInt(market.typBinaryScalar().low)) *
                  BigInt(payouts[1].payoutNumerator)) /
                  10_000n) /
              10n ** 18n
            }`}
          {/* {payouts[0].payoutNumerator > 0 && (
            <>
              <Button className="bg-progress-bar-good text-white hover:bg-progress-bar-good/80">
                YES
              </Button>
              <HStack className="text-brilliance">
                <TrendingUp />
                {Math.ceil(
                  (Number(market.odds[1]) / Number(market.odds[0])) * 100,
                )}
                %
              </HStack>
            </>
          )}
          {payouts[1].payoutNumerator > 0 && (
            <>
              <Button className="bg-danger text-lightest hover:bg-danger/80">
                NO
              </Button>
              <HStack className="text-brilliance">
                <TrendingUp />
                {Math.ceil(
                  (Number(market.odds[0]) / Number(market.odds[1])) * 100,
                )}
                %
              </HStack>
            </>
          )} */}
        </HStack>
      )}

      {market.typCategorical() && (
        <HStack className="justify-center gap-3">
          {payouts.map((payout, idx) => {
            if (payout.payoutNumerator === 0) return null;
            return (
              <VStack className="text-brilliance justify-center" key={idx}>
                <Button variant="secondary">
                  <MaybeController address={payout.name} />
                </Button>
                <HStack className="w-full justify-center">
                  <TrendingUp />
                  {Math.ceil(100 / Number(market.odds![idx])) * 100}%
                </HStack>
              </VStack>
            );
          })}
        </HStack>
      )}
    </div>
  );
}
