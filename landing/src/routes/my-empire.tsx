import { AnimatedGrid } from "@/components/modules/animated-grid";
import { DataCard } from "@/components/modules/data-card";
import { TypeH2 } from "@/components/typography/type-h2";
//import { GET_USERS } from "@/hooks/query/players";
import { createFileRoute } from "@tanstack/react-router";
import { Coins, UsersIcon } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/my-empire")({
  component: MyEmpire,
});

function MyEmpire() {
  /*onst { data } = useQuery({
    queryKey: ["number-of-players"],
    queryFn: () => execute(GET_USERS),
  });*/
  const dataCards = useMemo(
    () => [
      {
        title: "players",
        value:/* data?.eternumOwnerModels?.totalCount ?? */0,
        icon: <UsersIcon />,
      },
      {
        title: "lords prize pool",
        value: "1,000,000",
        icon: <Coins />,
      },
    ],
    [/*data*/],
  );
  return (
    <>
      <TypeH2>My Empire</TypeH2>
      <AnimatedGrid items={dataCards} renderItem={(item) => <DataCard {...item} />} />
    </>
  );
}
