import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Unlock } from "lucide-react";
import {
  Label,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";
import { Address, useAccount, useBalance, useContract, useReadContract, useSendTransaction } from "@starknet-react/core";
import { shortenAddress, SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { LORDS, StakingAddresses } from "@realms-world/constants";
import { useEffect, useMemo } from "react";
import { StakeDialog } from "./stake-dialog";
import { VeLords } from "@/abi/L2/VeLords";
import { BlockNumber, BlockTag } from "starknet";
import { formatEther } from "viem";
import { UnlockDialog } from "./unlock-dialog";
import { toast } from "@/hooks/use-toast";
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

export const StakeLords = () => {
  const { address } = useAccount();
  const { isLoading, data } = useBalance({
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
  const {
    sendAsync: manageLordsLock,
    data: manageHash,
    isPending: manageIsSubmitting,
  } = useSendTransaction({});

  const {
    sendAsync: claimRewards,
    data: claimHash,
    isPending: claimIsSubmitting,
  } = useSendTransaction({});

  const {
    sendAsync: withdraw,
    data: withdrawHash,
    isPending: withdrawsSubmitting,
  } = useSendTransaction({
    calls: veLordsContract && address ? [veLordsContract?.populate("withdraw", [])] : undefined,
  });

  const chartData = [
    { month: "January", locked: Number(formatEther(BigInt(ownerLordsLock?.amount ?? 0n))), unlocked: Number(data?.formatted) },
  ];
  const totalLords = useMemo(() => {
    return (chartData[0].unlocked ?? 0) + chartData[0].locked;
  }, [chartData[0].unlocked, chartData[0].locked]);

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
          className="h-[170px] w-full relative"
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
                          y={(viewBox.cy || 0) - 16}
                          className="fill-foreground text-2xl font-bold"
                        >
                          {totalLords.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 4}
                          className="fill-muted-foreground"
                        >
                          Your Total $LORDS
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </PolarRadiusAxis>
            <RadialBar
              dataKey="locked"
              stackId="a"
              fill="var(--color-locked)"
              cornerRadius={5}
            />
            <RadialBar
              dataKey="unlocked"
              stackId="a"
              fill="var(--color-unlocked)"
              cornerRadius={5}
            />
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex gap-2 mb-4">
          <StakeDialog ownerLordsLock={ownerLordsLock} lordsBalance={Number(data?.formatted)} manageLordsLock={manageLordsLock}/>
          <UnlockDialog ownerLordsLock={ownerLordsLock} lordsBalance={Number(data?.formatted)} withdraw={withdraw}/>
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
