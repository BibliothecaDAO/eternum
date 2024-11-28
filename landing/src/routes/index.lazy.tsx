import { AnimatedGrid } from "@/components/modules/animated-grid";
import { DataCard } from "@/components/modules/data-card";
import { Leaderboard } from "@/components/modules/leaderboard";
import { execute } from "@/hooks/gql/execute";
import { GET_USERS } from "@/hooks/query/players";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Coins, UsersIcon } from "lucide-react";
import { useMemo } from "react";

export const Route = createLazyFileRoute("/")({
  component: Index,
});

function Index() {
  const { data } = useQuery({
    queryKey: ["number-of-players"],
    queryFn: () => execute(GET_USERS),
  });

  const dataCards = useMemo(
    () => [
      {
        title: "players",
        value: data?.eternumOwnerModels?.totalCount ?? 0,
        icon: <UsersIcon />,
      },
      {
        title: "lords prize pool",
        value: "1,000,000",
        icon: <Coins />,
      },
    ],
    [data],
  );

  return (
    <div className="flex flex-col gap-y-4">
      <AnimatedGrid items={dataCards} renderItem={(item) => <DataCard {...item} />} />
      <Leaderboard />
    </div>
  );
}
