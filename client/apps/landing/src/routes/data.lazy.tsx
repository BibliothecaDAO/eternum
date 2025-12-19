import { TypeH1 } from "@/components/typography/type-h1";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/hooks/use-data";
import { OG_IMAGE_META } from "@/lib/seo";
import { divideByPrecision } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/data")({
  component: Index,
  head: () => ({ meta: OG_IMAGE_META }),
});

function Index() {
  const {
    donkeyBurn,
    seasonDay,
    totalGuilds,
    totalStructures,
    totalTroops,
    totalBattles,
    totalAgents,
    totalCreatedAgents,
    isLoading,
    totalPlayers,
    totalTransactions,
  } = useData();

  if (isLoading) {
    return <div className="p-8 text-center text-lg">Loading...</div>;
  }

  return (
    <div>
      <TypeH1 className="text-2xl font-semibold mb-2 sm:mb-4 mt-6 sm:mt-8 mx-auto flex justify-center">
        Season 1 - {seasonDay?.dayString}
      </TypeH1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-2 sm:gap-4 px-2 sm:px-4">
        <Card className="@container/card col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-2">
          <CardHeader className="relative">
            <CardDescription>Total Players</CardDescription>
            <CardTitle className="text-4xl font-semibold tabular-nums">{totalPlayers}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-2">
          <CardHeader className="relative">
            <CardDescription>Total Transactions</CardDescription>
            <CardTitle className="text-4xl font-semibold tabular-nums">{totalTransactions?.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-2">
          <CardHeader className="relative">
            <CardDescription>Donkey Burn</CardDescription>
            <CardTitle className="text-4xl font-semibold tabular-nums">
              {divideByPrecision(donkeyBurn ?? 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardDescription>Total Guilds</CardDescription>
            <CardTitle className="text-4xl font-semibold tabular-nums">
              {totalGuilds?.toLocaleString?.() ?? totalGuilds}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-3">
          <CardHeader>
            <CardDescription>Total Battles</CardDescription>
            <CardTitle className="text-4xl font-semibold tabular-nums">
              {totalBattles?.toLocaleString?.() ?? totalBattles}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-3">
          <CardHeader>
            <CardDescription>Total Agents (alive/ created)</CardDescription>
            <CardTitle className="text-4xl font-semibold tabular-nums">
              {totalAgents?.toLocaleString?.() ?? totalAgents} /{" "}
              {totalCreatedAgents?.toLocaleString?.() ?? totalCreatedAgents}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="col-span-1 sm:col-span-2 md:col-span-4 lg:col-span-4">
          <CardHeader>
            <CardDescription>Total Structures</CardDescription>
            <CardTitle className="text-4xl font-semibold tabular-nums">
              {Array.isArray(totalStructures)
                ? totalStructures.reduce((sum, s) => sum + (s.structure_count || 0), 0).toLocaleString()
                : (Number(totalStructures)?.toLocaleString?.() ?? totalStructures)}
            </CardTitle>
            {Array.isArray(totalStructures) && (
              <div className="mt-2 sm:mt-4 grid grid-cols-2 sm:grid-cols-3 grid-rows-2 gap-1 sm:gap-2 text-xs font-medium">
                {totalStructures.map((s, i) => (
                  <div key={i} className="bg-muted rounded p-1 sm:p-2 flex flex-col items-center justify-center">
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold">
                      {StructureType[s.category]}
                    </span>
                    <span className="text-base font-bold tabular-nums">{s.structure_count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardHeader>
        </Card>
        <Card className="col-span-1 sm:col-span-2 md:col-span-4 lg:col-span-4">
          <CardHeader>
            <CardDescription>Total Troops</CardDescription>
            <CardTitle className="text-4xl font-semibold tabular-nums">
              {Array.isArray(totalTroops)
                ? divideByPrecision(totalTroops.reduce((sum, t) => sum + (t.total_troops || 0), 0))?.toLocaleString()
                : divideByPrecision(Number(totalTroops))?.toLocaleString()}
            </CardTitle>
            {Array.isArray(totalTroops) && (
              <div className="mt-2 sm:mt-4 grid grid-cols-2 sm:grid-cols-3 gap-1 sm:gap-2 font-medium overflow-y-auto">
                {totalTroops.map((t, i) => (
                  <div key={i} className="bg-muted rounded p-1 sm:p-2 flex flex-col items-center justify-center">
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold">
                      {t.category}, {t.tier}
                    </span>
                    <span className="text-base font-bold tabular-nums">
                      {divideByPrecision(t.total_troops)?.toLocaleString?.()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
