import type { ChartConfig } from "@/components/ui/chart";
import type { Address } from "@starknet-start/react";
import type { BlockNumber } from "starknet";
import { useMemo } from "react";
import { VeLords } from "@/abi/L2/VeLords";
import LordsIcon from "@/components/icons/lords.svg?react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  abbreviateNumber,
  formatNumber,
  SUPPORTED_L2_CHAIN_ID,
} from "@/utils/utils";
import {
  useAccount,
  useBalance,
  useContract,
  useReadContract,
  useSendTransaction,
} from "@starknet-start/react";
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";
import { BlockTag } from "starknet";
import { formatEther } from "viem";

import { LORDS, StakingAddresses } from "@realms-world/constants";

import { StakeDialog } from "./stake-dialog";
import { UnlockDialog } from "./unlock-dialog";
import { StarknetWalletButton } from "@/components/layout/starknet-wallet-button";

const chartConfig = {
  locked: {
    label: "Staked",
    color: "hsl(var(--chart-2))",
  },
  unlocked: {
    label: "Available",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

// Helper function to abbreviate numbers

export const StakeLords = () => {
  const { address } = useAccount();
  const { data } = useBalance({
    address,
    token: LORDS[SUPPORTED_L2_CHAIN_ID]?.address as Address,
    watch: true,
  });
  const veLordsAddress = StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID];

  const { data: ownerLordsLock } = useReadContract({
    address: veLordsAddress as Address,
    abi: VeLords,
    functionName: "get_lock_for",
    //enabled: !!l2Address,
    watch: true,
    args: address ? [address] : undefined,
    blockIdentifier: BlockTag.PENDING as BlockNumber,
  });
  const { contract: veLordsContract } = useContract({
    abi: VeLords,
    address: veLordsAddress as Address,
  });
  const { sendAsync: manageLordsLock } = useSendTransaction({});

  const { sendAsync: withdraw } = useSendTransaction({
    calls:
      veLordsContract && address
        ? [veLordsContract.populate("withdraw", [])]
        : undefined,
  });

  const availableLords = Number(data?.formatted ?? 0);

  const chartData = useMemo(
    () => [
      {
        month: "January",
        locked: Number(formatEther(BigInt(ownerLordsLock?.amount ?? 0n))),
        unlocked: availableLords,
      },
    ],
    [availableLords, ownerLordsLock?.amount],
  );
  const totalLords = useMemo(() => {
    return (
      Number(formatEther(BigInt(ownerLordsLock?.amount ?? 0n))) +
      availableLords
    );
  }, [availableLords, ownerLordsLock?.amount]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle>Lords Staking</CardTitle>
        <CardDescription>
          Your balances of locked and unlocked $LORDS
        </CardDescription>
      </CardHeader>
      {address ? <><div className="flex flex-col items-center sm:flex-row">
        <Card className="mt-4 sm:ml-8 sm:mt-0">
          <CardContent className="realm-stat flex items-center px-4 pb-0 pt-2 text-lg font-semibold md:text-2xl">
            <LordsIcon className="mr-2 h-6 w-6" />
            {formatNumber(availableLords)}
          </CardContent>
          <CardFooter className="text-muted-foreground px-4 pb-3 text-sm">
            Lords Available
          </CardFooter>
        </Card>
        <ChartContainer
          config={chartConfig}
          className="relative h-[180px] w-full"
        >
          <RadialBarChart
            accessibilityLayer
            data={chartData}
            endAngle={180}
            innerRadius={80}
            outerRadius={130}
            cx={"50%"}
            cy={"70%"}
          >
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent hideLabel className="ml-2 min-w-[180px]" />
              }
            />

            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy + 15}
                              className="fill-foreground text-lg font-bold"
                            >
                          {ownerLordsLock?.amount
                            ? abbreviateNumber(
                                formatEther(BigInt(ownerLordsLock.amount)),
                              )
                            : "0"}{" "}
                          /{abbreviateNumber(totalLords)}
                        </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy + 32}
                              className="fill-muted-foreground"
                            >
                          Staked / Total $LORDS
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </PolarRadiusAxis>

            <RadialBar
              dataKey="unlocked"
              stackId="a"
              fill="var(--color-chart-5)"
              cornerRadius={5}
            />
            <RadialBar
              order={0}
              dataKey="locked"
              stackId="a"
              fill="var(--color-chart-1)"
              cornerRadius={5}
            />
          </RadialBarChart>
        </ChartContainer>
      </div>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="mb-4 flex gap-2">
            <StakeDialog
              ownerLordsLock={ownerLordsLock}
              lordsBalance={availableLords}
              manageLordsLock={manageLordsLock}
            />
            <UnlockDialog
              ownerLordsLock={ownerLordsLock}
              lordsBalance={availableLords}
              withdraw={withdraw}
            />
        </div>
        <div className="flex items-center gap-2 font-medium leading-none">
          veLords are entitled to a share of Lords fees from ecosystem games and
          marketplaces. One lock per wallet address.
        </div>
        <div className="text-muted-foreground leading-none">
          Note: max 75% penalty for early withdrawal (if withdrawn immediately
          after locking for 4 years)
        </div>
      </CardFooter>
      </>
      :<CardContent className="mt-4">
      <StarknetWalletButton label="Connect Wallet to Stake" />
      </CardContent >
      }
    </Card>
  );
};
