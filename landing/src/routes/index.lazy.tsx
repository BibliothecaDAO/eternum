import { AnimatedGrid } from "@/components/modules/animated-grid";
import { DataCard, DataCardProps } from "@/components/modules/data-card";
import { Leaderboard } from "@/components/modules/leaderboard";
import { PRIZE_POOL_GUILDS, PRIZE_POOL_PLAYERS } from "@/constants";
import { useDonkeysBurned } from "@/hooks/use-donkeys-burned";
import { useLordsBridgeBalance } from "@/hooks/use-lords-bridged";
import { usePlayerCount } from "@/hooks/use-player-count";
import { useRealmsSettled } from "@/hooks/use-realms-settled";
import { currencyFormat, formatNumber } from "@/lib/utils";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Castle, Coins, CoinsIcon, Flame, UsersIcon } from "lucide-react";
import React, { useMemo } from "react";

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
  const realmsSettled = useRealmsSettled();
  const playerCount = usePlayerCount();

  const [_, lordsBalance] = useLordsBridgeBalance();

  const dataCards: GridItemType[] = useMemo(
    () => [
      {
        colSpan: { sm: 2, md: 3, lg: 3 },
        rowSpan: { sm: 1, md: 1, lg: 2 },
        data: {
          title: "players",
          value: formatNumber(playerCount, 0),
          icon: <UsersIcon />,
          backgroundImage: "/images/avatars/Armor.png",
        },
      },
      {
        colSpan: { sm: 2, md: 3, lg: 3 },
        data: {
          title: "realms settled",
          value: formatNumber(realmsSettled, 0),
          icon: <Castle />,
          backgroundImage: "/images/avatars/Blade.png",
        },
      },
      {
        colSpan: { sm: 2, md: 3, lg: 3 },
        data: {
          title: "lords prize pool",
          value: formatNumber(PRIZE_POOL_GUILDS + PRIZE_POOL_PLAYERS, 0),
          icon: <Coins />,
          backgroundImage: "/images/avatars/Hidden.png",
        },
      },
      {
        colSpan: { sm: 2, md: 3, lg: 3 },
        data: {
          title: "donkeys burned",
          value: currencyFormat(donkeysBurned, 0),
          icon: <Flame />,
          backgroundImage: "/images/jungle-clouds.png",
        },
      },
      {
        colSpan: { sm: 2, md: 6, lg: 6 },
        data: {
          title: "Bridge Lords Balance",
          value: formatNumber(lordsBalance, 0),
          icon: <CoinsIcon />,
          backgroundImage: "/images/hidden-castle.png",
        },
      },
    ],
    [playerCount, donkeysBurned, realmsSettled, lordsBalance],
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
