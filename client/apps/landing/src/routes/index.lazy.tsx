import { AnimatedGrid } from "@/components/modules/animated-grid";
import { BridgedResources } from "@/components/modules/bridged-resources";
import { DataCard, DataCardProps } from "@/components/modules/data-card";
import {
  PRIZE_POOL_ACHIEVEMENTS,
  PRIZE_POOL_CONTENT_CREATORS,
  PRIZE_POOL_GUILDS,
  PRIZE_POOL_INDIVIDUAL_LEADERBOARD,
} from "@/constants";
import { execute } from "@/hooks/gql/execute";
import { GET_ETERNUM_STATISTICS } from "@/hooks/query/eternum-statistics";
import { useDonkeysBurned } from "@/hooks/use-donkeys-burned";
import { useLordsBridgeBalance } from "@/hooks/use-lords-bridged";
import { usePrizePool } from "@/hooks/use-rewards";
import { currencyFormat, formatNumber } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Castle, Coins, CoinsIcon, Flame, Pickaxe, Sparkles, UsersIcon } from "lucide-react";
import React, { useMemo } from "react";
import { formatEther } from "viem";

export const Route = createLazyFileRoute("/")({
  component: Index,
});

interface GridItemType {
  colSpan: {
    sm: number;
    md: number;
    lg: number;
  };
  data: DataCardProps | React.ReactElement;
}

function Index() {
  const { data } = useQuery({
    queryKey: ["eternumStatistics"],
    queryFn: () => execute(GET_ETERNUM_STATISTICS),
    refetchInterval: 30_000,
  });

  const donkeysBurned = useDonkeysBurned();
  const lordsBalance = useLordsBridgeBalance();

  const prizePoolPlayers = usePrizePool();

  const dataCards: GridItemType[] = useMemo(
    () => [
      {
        colSpan: { sm: 2, md: 2, lg: 2 },
        rowSpan: { sm: 1, md: 1, lg: 2 },
        data: {
          title: "players",
          value: formatNumber(data?.s1EternumAddressNameModels?.totalCount ?? 0, 0),
          icon: <UsersIcon />,
          backgroundImage: "/images/avatars/12.png",
        },
      },
      {
        colSpan: { sm: 2, md: 2, lg: 2 },
        data: {
          title: "realms settled",
          value: formatNumber(data?.realms?.totalCount ?? 0, 0),
          icon: <Castle />,
          backgroundImage: "/images/avatars/09.png",
        },
      },
      {
        colSpan: { sm: 2, md: 2, lg: 2 },
        data: {
          title: "hyperstructures",
          value: formatNumber(data?.hyperstructures?.totalCount ?? 0, 0),
          icon: <Sparkles />,
          backgroundImage: "/images/avatars/06.png",
        },
      },
      {
        colSpan: { sm: 2, md: 2, lg: 2 },
        data: {
          title: "mines discovered",
          value: formatNumber(data?.mines?.totalCount ?? 0, 0),
          icon: <Pickaxe />,
          backgroundImage: "/images/covers/03.png",
        },
      },
      {
        colSpan: { sm: 2, md: 4, lg: 4 },
        data: {
          title: "lords prize pool",
          value: formatNumber(
            PRIZE_POOL_GUILDS +
              Number(formatEther(prizePoolPlayers)) +
              PRIZE_POOL_ACHIEVEMENTS +
              PRIZE_POOL_INDIVIDUAL_LEADERBOARD +
              PRIZE_POOL_CONTENT_CREATORS,
            0,
          ),
          icon: <Coins />,
          backgroundImage: "/images/avatars/06.png",
        },
      },
      {
        colSpan: { sm: 2, md: 6, lg: 6 },
        data: {
          title: "donkeys burned",
          value: currencyFormat(donkeysBurned, 0),
          icon: <Flame />,
          backgroundImage: "/images/covers/03.png",
        },
      },
      {
        colSpan: { sm: 2, md: 4, lg: 4 },
        data: {
          title: "Bridge Lords Balance",
          value: formatNumber(lordsBalance, 0),
          icon: <CoinsIcon />,
          backgroundImage: "/images/covers/04.png",
        },
      },
    ],
    [data?.s1EternumAddressNameModels, prizePoolPlayers, donkeysBurned, lordsBalance],
  );

  return (
    <div className="p-4">
      <AnimatedGrid
        items={[
          ...dataCards,
          {
            colSpan: { sm: 2, md: 6, lg: 12 },
            rowSpan: { sm: 1, md: 1, lg: 2 },
            data: <BridgedResources />,
          },
        ]}
        renderItem={(item) =>
          React.isValidElement(item.data) ? item.data : <DataCard {...(item.data as DataCardProps)} />
        }
      />
    </div>
  );
}
