import { ReactComponent as EternumWordsLogo } from "@/assets/icons/realms-words-logo-g.svg";
import { CollectionCard } from "@/components/modules/collection-card";
import { CollectionTokenGrid } from "@/components/modules/collection-token-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { marketplaceCollections, realmsAddress, seasonPassAddress } from "@/config";
import {
  ActiveMarketOrdersTotal,
  fetchCollectionStatistics,
  fetchSeasonPassRealmsByAddress,
  fetchTokenBalancesWithMetadata,
} from "@/hooks/services";
import type { GameStatus } from "@/hooks/services/game-status";
import { DEFAULT_GAME_STATUS, fetchGameStatus } from "@/hooks/services/game-status";
import { trimAddress } from "@/lib/utils";
import { MergedNftData } from "@/types";
import { useAccount } from "@starknet-react/core";
import { useQuery, useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AlertTriangle, Castle, CirclePlayIcon } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

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

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[70vh] min-h-[600px] flex items-center justify-center pb-16 pt-8">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/covers/01.png')" }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="relative z-10 text-center px-4 w-full max-w-screen-lg">
          <h1 className="text-gold fill-gold">
            <EternumWordsLogo className="mx-auto w-48 fill-current stroke-current sm:w-60 md:w-72 lg:w-96 mb-8 sm:mb-12 lg:mb-16" />
          </h1>
          <GamePhaseBanner status={gameStatus} isLoading={isGameStatusLoading} />
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

const GamePhaseBanner = memo(function GamePhaseBanner({
  status,
  isLoading,
}: {
  status: GameStatus;
  isLoading: boolean;
}) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [milestonesOpen, setMilestonesOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const interval = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const phaseLabelMap: Record<GameStatus["currentPhase"], string> = {
    NO_GAME: "No Realms: Blitz Game Scheduled",
    REGISTRATION: "Realms: Blitz Registration Open",
    GAME_ACTIVE: "Realms: Blitz Game In Progress",
  };

  const currentPhaseLabel = phaseLabelMap[status.currentPhase];

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
    return null;
  }, [status]);

  return (
    <motion.div className="inline-flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-gold/30 bg-background/80 p-6 text-left shadow-xl backdrop-blur mt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Current Phase</p>
          <h2 className="mt-1 text-3xl font-serif text-gold">{isLoading ? "Loading…" : currentPhaseLabel}</h2>
          {countdownData.label && countdownSeconds !== null && (
            <p className="mt-2 text-sm text-muted-foreground">
              {countdownData.label}{" "}
              <span className="font-semibold text-foreground">{formatCountdown(countdownSeconds)}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end text-sm text-muted-foreground">
          {status.registrationCount !== undefined && (
            <Badge variant="outline" className="border-gold/50 bg-gold/10 text-gold">
              {status.registrationCount.toLocaleString()} registered
            </Badge>
          )}
          {nextPhaseDescription && <p>{nextPhaseDescription}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button size="lg" className="text-lg px-8 py-6" asChild>
            <a href="https://dev.blitz.realms.world/" target="_blank" rel="noopener noreferrer">
              <CirclePlayIcon className="!w-6 !h-6 mr-2" /> Play Desktop Version
            </a>
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8 py-6" asChild>
            <a href="https://dev.m.blitz.realms.world/home" target="_blank" rel="noopener noreferrer">
              <CirclePlayIcon className="!w-6 !h-6 mr-2" /> Play Mobile Version
            </a>
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 px-3 py-2 rounded-lg border border-amber-400/20">
          <AlertTriangle className="w-4 h-4" />
          <p>Both clients run on the Blitz testnet. Expect rapid iteration.</p>
        </div>
      </div>

      {phaseDetails.length > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setMilestonesOpen(true)}>
            Upcoming milestones
          </Button>
        </div>
      )}

      <Dialog open={milestonesOpen} onOpenChange={setMilestonesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gold">Upcoming milestones</DialogTitle>
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
