import { AnimatedGrid } from "@/components/modules/animated-grid";
import { DataCard } from "@/components/modules/data-card";
import { Leaderboard } from "@/components/modules/leaderboard";
import { PRIZE_POOL_AMOUNT } from "@/constants";
import { execute } from "@/hooks/gql/execute";
import { GET_USERS } from "@/hooks/query/players";
import { useDonkeysBurned } from "@/hooks/use-donkeys-burned";
import { useRealmsSettled } from "@/hooks/use-realms-settled";
import { currencyFormat, formatNumber } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Castle, Coins, Flame, UsersIcon } from "lucide-react";
import { useMemo } from "react";

export const Route = createLazyFileRoute("/")({
  component: Index,
});

function Index() {
  const { data } = useQuery({
    queryKey: ["number-of-players"],
    queryFn: () => execute(GET_USERS),
  });

  const donkeysBurned = useDonkeysBurned();
  const realmsSettled = useRealmsSettled();

  const dataCards = useMemo(
    () => [
      {
        title: "players",
        value: formatNumber(data?.eternumOwnerModels?.totalCount ?? 0, 0),
        icon: <UsersIcon />,
      },
      {
        title: "realms settled",
        value: formatNumber(realmsSettled, 0),
        icon: <Castle />,
      },
      {
        title: "lords prize pool",
        // todo: get this from the contract
        value: formatNumber(PRIZE_POOL_AMOUNT, 0),
        icon: <Coins />,
      },
      {
        title: "donkeys burned",
        value: currencyFormat(donkeysBurned, 0),
        icon: <Flame />,
      },
    ],
    [data, donkeysBurned],
  );

  return (
    <div className="flex flex-col gap-y-4">
      <AnimatedGrid items={dataCards} renderItem={(item) => <DataCard {...item} />} />
      <Leaderboard />
    </div>
  );
}
