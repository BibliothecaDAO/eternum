import { AnimatedGrid } from "@/components/modules/animated-grid";
import { DataCard, DataCardProps } from "@/components/modules/data-card";
import { Leaderboard } from "@/components/modules/leaderboard";
import { PRIZE_POOL_ACHIEVEMENTS, PRIZE_POOL_GUILDS, PRIZE_POOL_INDIVIDUAL_LEADERBOARD } from "@/constants";
import { useDonkeysBurned } from "@/hooks/use-donkeys-burned";
import { useLordsBridgeBalance } from "@/hooks/use-lords-bridged";
import { usePlayerCount } from "@/hooks/use-player-count";
import { usePrizePool } from "@/hooks/use-rewards";
import { useStructuresNumber } from "@/hooks/use-structures";
import { currencyFormat, formatNumber } from "@/lib/utils";
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
  const donkeysBurned = useDonkeysBurned();
  const playerCount = usePlayerCount();
  const { realmsCount, hyperstructuresCount, fragmentMinesCount } = useStructuresNumber();
  const lordsBalance = useLordsBridgeBalance();

  const prizePoolPlayers = usePrizePool();

  const dataCards: GridItemType[] = useMemo(
    () => [
      {
        colSpan: { sm: 2, md: 2, lg: 2 },
        rowSpan: { sm: 1, md: 1, lg: 2 },
        data: {
          title: "players",
          value: formatNumber(playerCount, 0),
          icon: <UsersIcon />,
          backgroundImage: "/images/avatars/Armor.png",
        },
      },
      {
        colSpan: { sm: 2, md: 2, lg: 2 },
        data: {
          title: "realms settled",
          value: formatNumber(realmsCount, 0),
          icon: <Castle />,
          backgroundImage: "/images/avatars/Blade.png",
        },
      },
      {
        colSpan: { sm: 2, md: 2, lg: 2 },
        data: {
          title: "hyperstructures",
          value: formatNumber(hyperstructuresCount, 0),
          icon: <Sparkles />,
          backgroundImage: "/images/avatars/Hidden.png",
        },
      },
      {
        colSpan: { sm: 2, md: 2, lg: 2 },
        data: {
          title: "mines discovered",
          value: formatNumber(fragmentMinesCount, 0),
          icon: <Pickaxe />,
          backgroundImage: "/images/jungle-clouds.png",
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
              PRIZE_POOL_INDIVIDUAL_LEADERBOARD,
            0,
          ),
          icon: <Coins />,
          backgroundImage: "/images/avatars/Hidden.png",
        },
      },
      {
        colSpan: { sm: 2, md: 6, lg: 6 },
        data: {
          title: "donkeys burned",
          value: currencyFormat(donkeysBurned, 0),
          icon: <Flame />,
          backgroundImage: "/images/jungle-clouds.png",
        },
      },
      {
        colSpan: { sm: 2, md: 4, lg: 4 },
        data: {
          title: "Bridge Lords Balance",
          value: formatNumber(lordsBalance, 0),
          icon: <CoinsIcon />,
          backgroundImage: "/images/hidden-castle.png",
        },
      },
    ],
    [playerCount, donkeysBurned, realmsCount, hyperstructuresCount, fragmentMinesCount, lordsBalance],
  );

  return (
    <div className="p-4">
      <AnimatedGrid
        items={[
          ...dataCards,
          {
            colSpan: { sm: 2, md: 6, lg: 12 },
            rowSpan: { sm: 1, md: 1, lg: 2 },
            data: <Leaderboard />,
          },
        ]}
        renderItem={(item) =>
          React.isValidElement(item.data) ? item.data : <DataCard {...(item.data as DataCardProps)} />
        }
      />
    </div>
  );
}
