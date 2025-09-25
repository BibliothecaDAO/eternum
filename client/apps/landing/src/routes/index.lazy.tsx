import { ReactComponent as EternumWordsLogo } from "@/assets/icons/realms-words-logo-g.svg";
import { CollectionCard } from "@/components/modules/collection-card";
import { CollectionTokenGrid } from "@/components/modules/collection-token-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { marketplaceCollections, realmsAddress, seasonPassAddress } from "@/config";
import {
  ActiveMarketOrdersTotal,
  fetchCollectionStatistics,
  fetchPlayerLeaderboard,
  fetchSeasonPassRealmsByAddress,
  fetchTokenBalancesWithMetadata,
} from "@/hooks/services";
import type { GameStatus } from "@/hooks/services/game-status";
import { DEFAULT_GAME_STATUS, fetchGameStatus } from "@/hooks/services/game-status";
import { displayAddress, trimAddress } from "@/lib/utils";
import { MergedNftData } from "@/types";
import { useAccount } from "@starknet-react/core";
import { useQuery, useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AlertTriangle, Boxes, Castle, CirclePlayIcon, Clock, Swords, Trophy, UserRoundPlus } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

interface LeaderboardCardEntry {
  rank: number;
  displayName: string;
  displayAddress: string;
  displayPoints: string;
  playerAddress: string;
}

export const Route = createLazyFileRoute("/")({
  component: Index,
});

function Index() {
  const { address: accountAddress } = useAccount();

  // Fetch marketplace collection statistics
  const collections = Object.entries(marketplaceCollections).filter(([key, collection]) => collection.address != "");
  const collectionStatisticsQueries = collections.map(([key, collection]) => ({
    queryKey: ["activeMarketOrdersTotal", key],
    queryFn: () => (collection.address !== "" ? fetchCollectionStatistics(collection.address) : null),
    refetchInterval: 30_000,
  }));

  const userCollectionsQueries = [
    {
      queryKey: ["realmsTokenBalance", accountAddress],
      queryFn: () => (accountAddress ? fetchTokenBalancesWithMetadata(realmsAddress, accountAddress) : null),
      refetchInterval: 8_000,
    },
    /*{
      queryKey: ["seasonPassTokenBalance", accountAddress],
      queryFn: () => (accountAddress ? fetchTokenBalancesWithMetadata(seasonPassAddress, accountAddress) : null),
      refetchInterval: 8_000,
    },*/
    {
      queryKey: ["seasonPassMints", trimAddress(accountAddress)],
      queryFn: () =>
        accountAddress
          ? fetchSeasonPassRealmsByAddress(realmsAddress, seasonPassAddress, trimAddress(accountAddress))
          : null,
      refetchInterval: 10_000,
    },
  ];

  const results = useSuspenseQueries({
    queries: [...userCollectionsQueries, ...collectionStatisticsQueries],
  });

  // Properly type and extract the results
  const realms = results[0];
  const collectionStats = results.slice(3) as { data: ActiveMarketOrdersTotal[] }[];
  const ownedRealms = (realms.data ?? []) as MergedNftData[];
  const hasRealms = ownedRealms.length > 0;
  const totalRealmCount = ownedRealms.length;
  const featuredRealms = ownedRealms.slice(0, 6) as MergedNftData[];

  const { data: fetchedGameStatus, isLoading: isGameStatusLoading } = useQuery({
    queryKey: ["game-status"],
    queryFn: fetchGameStatus,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const { data: leaderboardData } = useQuery({
    queryKey: ["player-leaderboard", 3],
    queryFn: () => fetchPlayerLeaderboard(3),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const leaderboardFormatter = useMemo(
    () => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }),
    [],
  );

  const topPlayers = useMemo<LeaderboardCardEntry[]>(() => {
    if (!leaderboardData) return [];

    return leaderboardData.slice(0, 3).map((entry, index) => {
      const safeAddress = entry.playerAddress && entry.playerAddress.length > 0 ? entry.playerAddress : "";
      const normalizedAddress = safeAddress ? trimAddress(safeAddress) : "";
      const shortAddress = normalizedAddress ? displayAddress(normalizedAddress) : "Unknown";
      const displayName = entry.playerName && entry.playerName.length > 0 ? entry.playerName : shortAddress;

      return {
        rank: index + 1,
        displayName,
        displayAddress: shortAddress,
        displayPoints: leaderboardFormatter.format(Math.floor(entry.registeredPoints)),
        playerAddress: safeAddress || `${index}-unknown`,
      };
    });
  }, [leaderboardData, leaderboardFormatter]);

  console.log({topPlayers})

  const gameStatus = fetchedGameStatus ?? DEFAULT_GAME_STATUS;

  // Framer Motion variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
      },
    },
  };

  const howItWorksSteps = [
    {
      value: "register",
      title: "Register",
      description: "You have 2 hours every 6 hours to register for the next game before the lobby closes.",
      icon: UserRoundPlus,
      highlight: "Registration allows us to place everyone on the map at random locations when the game starts.",
    },
    {
      value: "settle",
      title: "Settle Your Realms",
      description: "When you settle, your 3 realms are placed randomly on the map and the game starts.",
      icon: Castle,
      highlight: "Everybody starts with the same 3 realms and the same resources. Randomly placed on the map. No one has an advantage.",
    },
    {
      value: "conquer",
      title: "Conquer for 2 Hours",
      description: "Once the game starts you have 2 hours to climb the leaderboard where every transaction is onchain.",
      icon: Swords,
      highlight: "You can win points by exploring tiles, conquering structures and controlling hyperstructures.",
    },
    {
      value: "loot",
      title: "Win Loot Chests or tokens",
      description: "Top performers earn rare chests packed with cosmetics, plus tokens.",
      icon: Boxes,
      highlight: "A subset of top players can earn prizes, with prize values increasing depending on whether it's a free-to-play game or if you need to pay to enter.",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section
        className="relative flex min-h-[540px] items-center justify-center bg-cover bg-center pb-16 pt-10"
        style={{ backgroundImage: "url('/images/covers/01.png')" }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 w-full px-4">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8">
            <EternumWordsLogo className="w-44 fill-gold drop-shadow-lg sm:w-56 md:w-64" />
            <CurrentCycleCard status={gameStatus} isLoading={isGameStatusLoading} topPlayers={topPlayers} />
          </div>
        </div>
      </section>

      {/* How Blitz Works */}
      <section className="border-y border-gold/10 bg-background/90 py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-10 max-w-2xl text-center space-y-3">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">How Blitz Works</h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Connect your wallet, settle your realms, battle for two hours, then claim your rewards. Rinse and repeat every six hours until the end of time.
            </p>
          </div>
          <Tabs defaultValue={howItWorksSteps[0].value} className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <TabsList className="flex w-full flex-col gap-2 rounded-2xl bg-background/70 p-3 backdrop-blur md:flex-row md:flex-wrap md:justify-between">
              {howItWorksSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <TabsTrigger
                    key={step.value}
                    value={step.value}
                    className="group flex flex-1 items-center justify-between gap-4 rounded-xl border border-transparent px-4 py-3 text-left text-sm font-medium text-muted-foreground transition hover:text-foreground data-[state=active]:border-gold/40 data-[state=active]:bg-gold/10 data-[state=active]:text-foreground"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 font-semibold text-gold">
                        {index + 1}
                      </span>
                      <span className="text-sm sm:text-base">{step.title}</span>
                    </div>
                    <Icon className="h-5 w-5 text-gold/70 transition group-data-[state=active]:text-gold" />
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {howItWorksSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <TabsContent key={step.value} value={step.value} className="mt-0 focus-visible:outline-none">
                  <Card className="border-gold/20 bg-background/75 shadow-lg shadow-black/10 backdrop-blur">
                    <CardContent className="flex flex-col gap-5 p-6">
                      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-gold/80">
                        <span>Step {index + 1}</span>
                        <span className="hidden text-muted-foreground sm:inline">{step.title}</span>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex flex-1 flex-col gap-3">
                          <h3 className="text-2xl font-semibold text-foreground">{step.title}</h3>
                          <p className="text-sm text-muted-foreground sm:text-base">{step.description}</p>
                        </div>
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
                          <Icon className="h-6 w-6" />
                        </div>
                      </div>
                      <div className="rounded-lg border border-dashed border-gold/25 bg-gradient-to-br from-background/40 to-background/10 p-4 text-sm text-muted-foreground">
                        {step.highlight}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </section>

      {/* Marketplace Collections */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Marketplace Collections</h2>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {collections.map(([key, collection], index) => {
              const stats = collectionStats[index]?.data?.[0];
              return (
                <CollectionCard collectionKey={key} collection={collection} stats={stats} variants={itemVariants} />
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* User's Realms and Season Passes */}
      {accountAddress && (
        <section className="py-12 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 gap-12">
              <Card className="bg-background/70 border-gold/20 shadow-lg">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-2xl">Your Realms</CardTitle>
                    <CardDescription>Keep building your domain by managing the realms you already own.</CardDescription>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/$collection" params={{ collection: "realms" }}>
                      Manage All
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {hasRealms ? (
                    <>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Realms in wallet</span>
                        <Badge variant="secondary" className="bg-gold/15 text-gold border border-gold/30">
                          {totalRealmCount}
                        </Badge>
                      </div>
                      <CollectionTokenGrid tokens={featuredRealms} isCompactGrid pageId="home" />
                      {totalRealmCount > featuredRealms.length && (
                        <p className="text-xs text-muted-foreground text-center">
                          Showing the first {featuredRealms.length} realms — open "Manage All" to view the rest.
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="py-10 px-4 text-center text-muted-foreground flex flex-col items-center gap-4">
                      <Castle className="w-10 h-10 text-gold" />
                      <div>
                        <p className="text-base font-medium text-foreground">No realms in your wallet yet.</p>
                        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                          Explore the marketplace to acquire a Realm and start expanding your empire.
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button asChild size="sm">
                          <Link to="/trade/$collection" params={{ collection: "realms" }}>
                            Browse Marketplace
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/$collection" params={{ collection: "realms" }}>
                            Learn About Realms
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Season Passes Column
              <div>
                ...
              </div>*/}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

const CurrentCycleCard = memo(function CurrentCycleCard({
  status,
  isLoading,
  topPlayers,
}: {
  status: GameStatus;
  isLoading: boolean;
  topPlayers: LeaderboardCardEntry[];
}) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const interval = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const phaseLabelMap: Record<GameStatus["currentPhase"], string> = {
    NO_GAME: "No Blitz Game Scheduled",
    REGISTRATION: "Blitz Registration Open",
    GAME_ACTIVE: "Blitz Game In Progress",
  };

  const currentPhaseLabel = isLoading ? "Loading…" : phaseLabelMap[status.currentPhase];

  const phaseDetails = useMemo(() => {
    const items: Array<{ label: string; value: number | undefined }> = [
      { label: "Registration opens", value: status.registrationStartAt },
      { label: "Registration closes", value: status.registrationEndAt },
      { label: "Game starts", value: status.gameStartAt },
      { label: "Game ends", value: status.gameEndAt },
    ];
    return items.filter((item) => typeof item.value === "number").sort((a, b) => a.value! - b.value!);
  }, [status.gameEndAt, status.gameStartAt, status.registrationEndAt, status.registrationStartAt]);

  const countdownData = useMemo((): { label: string; target?: number } => {
    switch (status.currentPhase) {
      case "NO_GAME":
        return { label: "Registration opens in", target: status.registrationStartAt };
      case "REGISTRATION":
        return { label: "Registration closes in", target: status.registrationEndAt };
      case "GAME_ACTIVE":
        return { label: "Game ends in", target: status.gameEndAt };
      default:
        return { label: "" };
    }
  }, [status]);

  const countdownSeconds = useMemo(() => {
    if (!countdownData.target) return null;
    return Math.max(0, Math.floor(countdownData.target - now));
  }, [countdownData.target, now]);

  const nextPhaseDescription = useMemo(() => {
    if (status.currentPhase === "NO_GAME" && status.registrationStartAt) {
      return `Registration opens ${formatDateTime(status.registrationStartAt)}`;
    }
    if (status.currentPhase === "REGISTRATION" && status.gameStartAt) {
      return `Game launches ${formatDateTime(status.gameStartAt)}`;
    }
    if (status.currentPhase === "GAME_ACTIVE" && status.gameEndAt) {
      return `Game ends ${formatDateTime(status.gameEndAt)}`;
    }
    return "Next window to be announced";
  }, [status]);

  const countdownLabel = countdownData.label && countdownSeconds !== null ? countdownData.label : null;
  const countdownValue = countdownSeconds !== null ? formatCountdown(countdownSeconds) : null;
  const hasLeaderboard = topPlayers.length > 0;
  const winner = hasLeaderboard ? topPlayers[0] : null;
  const topPlayerSummary = winner?.displayName ?? "Leaderboard updating";

  useEffect(() => {
    if (!hasLeaderboard && showLeaderboard) {
      setShowLeaderboard(false);
    }
  }, [hasLeaderboard, showLeaderboard]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      <Card className="w-full border border-gold/20 bg-background/85 shadow-2xl shadow-black/20 backdrop-blur">
        <CardHeader className="flex flex-col gap-4 border-b border-gold/15 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-gold">
            <CirclePlayIcon className="h-6 w-6" />
            <div>
              <CardTitle className="text-xl">Current Blitz Cycle</CardTitle>
              <CardDescription className="text-xs uppercase tracking-[0.3em] text-gold/70">
                Live on Starknet Devnet
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="flex items-center gap-1 border-gold/30 bg-black/40 text-gold">
              <CirclePlayIcon className="h-3.5 w-3.5" />
              {currentPhaseLabel}
            </Badge>
            {countdownLabel && countdownValue && (
              <div className="flex items-center justify-between gap-2 rounded-full border border-gold/20 bg-black/30 px-3 py-1 whitespace-nowrap">
                <Clock className="h-3.5 w-3.5 text-gold" />
                <span className="min-w-[84px] text-center font-mono font-semibold text-foreground">{countdownValue}</span>
                <span className="text-xs text-muted-foreground">{countdownLabel.replace(" in", "")}</span>
              </div>
            )}
            <div className="flex items-center gap-1 rounded-full border border-gold/20 bg-black/30 px-3 py-1">
              <Trophy className="h-3.5 w-3.5 text-gold" />
              <span>{topPlayerSummary}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent
          className={`grid gap-6 p-6 ${hasLeaderboard && showLeaderboard ? "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" : ""}`}
        >
          <div className="flex flex-col gap-5">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">
                Blitz is the most advanced onchain game ever built. A fresh match starts every six hours—rally your realm before the next horn sounds.
              </p>
              <p>
                Need the finer details?{' '}
                <a
                  className="text-gold underline underline-offset-2"
                  href="https://docs.realms.world/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Review the documentation
                </a>
                .
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="flex-1 sm:flex-initial" asChild>
                <a href="https://dev.blitz.realms.world/" target="_blank" rel="noopener noreferrer">
                  <CirclePlayIcon className="mr-2 h-5 w-5" /> Play Desktop Version
                </a>
              </Button>
              <Button size="lg" variant="outline" className="flex-1 border-gold/40 text-gold sm:flex-initial" asChild>
                <a href="https://dev.m.blitz.realms.world/home" target="_blank" rel="noopener noreferrer">
                  <CirclePlayIcon className="mr-2 h-5 w-5" /> Play Mobile Version
                </a>
              </Button>
            </div>

            <div className="grid gap-3 rounded-xl border border-gold/15 bg-black/30 p-4 text-xs text-muted-foreground sm:grid-cols-3">
              <div>
                <span className="uppercase tracking-[0.25em] text-gold">Phase</span>
                <p className="mt-1 text-sm text-foreground">{currentPhaseLabel}</p>
              </div>
              <div>
                <span className="uppercase tracking-[0.25em] text-gold">Countdown</span>
                <p className="mt-1 text-sm text-foreground">{countdownValue ?? "—"}</p>
              </div>
              <div>
                <span className="uppercase tracking-[0.25em] text-gold">Next window</span>
                <p className="mt-1 text-sm text-foreground">{nextPhaseDescription}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Both clients run on the Blitz testnet. Expect rapid iteration.
            </div>

            {hasLeaderboard && winner && (
              <div className="flex flex-col gap-4 rounded-xl border border-gold/20 bg-black/25 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gold">
                    <Trophy className="h-4 w-4" />
                    Cycle leader
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gold/30 text-gold hover:bg-gold/10"
                    onClick={() => setShowLeaderboard((prev) => !prev)}
                  >
                    {showLeaderboard ? "Hide top 3" : "View top 3"}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-base font-semibold text-gold">
                      1
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">{winner.displayName}</span>
                      <span className="text-[11px] text-muted-foreground">{winner.displayAddress}</span>
                    </div>
                  </div>
                  <span className="text-lg font-semibold text-gold">
                    {winner.displayPoints}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">VP</span>
                  </span>
                </div>
              </div>
            )}

            {phaseDetails.length > 0 && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setMilestonesOpen(true)}>
                  Upcoming phases
                </Button>
              </div>
            )}
          </div>

          {hasLeaderboard && showLeaderboard && (
            <div className="flex h-full flex-col rounded-xl border border-gold/15 bg-black/30 p-5">
              <div className="flex items-center justify-between pb-3">
                <h3 className="text-sm font-semibold text-foreground">Top 3 Players</h3>
              </div>
              <div className="flex flex-1 flex-col gap-3">
                {topPlayers.map((player) => (
                  <div
                    key={`${player.rank}-${player.playerAddress}`}
                    className="flex items-center justify-between rounded-lg border border-gold/10 bg-black/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-sm font-semibold text-gold">
                        {player.rank}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">{player.displayName}</span>
                        <span className="text-[11px] text-muted-foreground">{player.displayAddress}</span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gold">
                      {player.displayPoints}
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">VP</span>
                    </span>
                  </div>
                ))}
              </div>
              <footer className="pt-3 text-[11px] text-muted-foreground">Data refreshes every 60 seconds via Torii.</footer>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={milestonesOpen} onOpenChange={setMilestonesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gold">Upcoming phases</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {phaseDetails.map((item) => (
              <div key={item.label} className="rounded-lg border border-border/60 bg-background/80 px-4 py-3 text-sm">
                <p className="font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.value ? formatDateTime(item.value) : "TBD"}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
});

function formatCountdown(seconds: number | null): string {
  if (seconds === null) return "—";
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3_600);
  const minutes = Math.floor((clamped % 3_600) / 60);
  const secs = Math.floor(clamped % 60);

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  return `${minutes.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1_000);
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
