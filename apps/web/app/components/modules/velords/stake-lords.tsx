import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import type {
  ChartConfig} from "@/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";
import type {
  Address} from "@starknet-react/core";
import {
  useAccount,
  useBalance,
  useContract,
  useReadContract,
  useSendTransaction,
} from "@starknet-react/core";
import { abbreviateNumber, SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { LORDS, StakingAddresses } from "@realms-world/constants";
import { useMemo } from "react";
import { StakeDialog } from "./stake-dialog";
import { VeLords } from "@/abi/L2/VeLords";
import type { BlockNumber} from "starknet";
import { BlockTag } from "starknet";
import { formatEther } from "viem";
import { UnlockDialog } from "./unlock-dialog";

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

  const chartData = useMemo(
    () => [
      {
        month: "January",
        locked: Number(formatEther(BigInt(ownerLordsLock?.amount ?? 0n))),
        unlocked: Number(data?.formatted),
      },
    ],
    [ownerLordsLock?.amount, data?.formatted]
  );
  const totalLords = useMemo(() => {
    return (
      Number(formatEther(BigInt(ownerLordsLock?.amount ?? 0n))) +
      Number(data?.formatted)
    );
  }, [ownerLordsLock?.amount, data?.formatted]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle>Lords Staking</CardTitle>
        <CardDescription>
          Your balances of locked and unlocked $LORDS
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 items-center pb-0">
        <ChartContainer
          config={chartConfig}
          className="h-[180px] w-full relative"
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
                          y={(viewBox.cy ?? 0) - 16}
                          className="fill-foreground text-lg font-bold"
                        >
                          {ownerLordsLock?.amount
                            ? abbreviateNumber(
                                formatEther(BigInt(ownerLordsLock.amount))
                              )
                            : "0"}{" "}
                          /{abbreviateNumber(totalLords)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 4}
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
              fill="var(--color-unlocked)"
              cornerRadius={5}
            />
            <RadialBar
              order={0}
              dataKey="locked"
              stackId="a"
              fill="var(--color-locked)"
              cornerRadius={5}
            />
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex gap-2 mb-4">
          <StakeDialog
            ownerLordsLock={ownerLordsLock}
            lordsBalance={Number(data?.formatted)}
            manageLordsLock={manageLordsLock}
          />
          <UnlockDialog
            ownerLordsLock={ownerLordsLock}
            lordsBalance={Number(data?.formatted)}
            withdraw={withdraw}
          />
        </div>
        <div className="flex items-center gap-2 font-medium leading-none">
          veLords are entitled to a share of Lords fees from ecosystem games and
          marketplaces. Claimable at weekly epochs
        </div>
        <div className="leading-none text-muted-foreground">
          Note: max 75% penalty for early withdrawal (if withdrawn immediately
          after locking for 4 years)
        </div>
      </CardFooter>
    </Card>
  );
};
