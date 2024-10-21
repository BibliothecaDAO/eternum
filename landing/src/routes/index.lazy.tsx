import { AnimatedGrid } from "@/components/modules/animated-grid";
import { DataCard } from "@/components/modules/data-card";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Coins, UsersIcon } from "lucide-react";

export const Route = createLazyFileRoute("/")({
  component: Index,
});

const dataCards = [
  {
    title: "players",
    value: "1000",
    icon: <UsersIcon />,
  },
  {
    title: "lords prize pool",
    value: "1,000,000",
    icon: <Coins />,
  },
];

function Index() {
  return <AnimatedGrid items={dataCards} renderItem={(item) => <DataCard {...item} />} />;
}
