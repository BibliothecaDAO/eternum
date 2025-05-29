import { ReactComponent as EternumWordsLogo } from "@/assets/icons/eternum-words-logo.svg";
import { ReactComponent as Sword } from "@/assets/icons/sword.svg";
import { CollectionTokenGrid } from "@/components/modules/collection-token-grid";
import { Button } from "@/components/ui/button";
import { marketplaceCollections, realmsAddress, seasonPassAddress } from "@/config";
import {
  ActiveMarketOrdersTotal,
  fetchCollectionStatistics,
  fetchSeasonPassRealmsByAddress,
  fetchTokenBalancesWithMetadata,
} from "@/hooks/services";
import { useData } from "@/hooks/use-data";
import { trimAddress } from "@/lib/utils";
import { useSelectedPassesStore } from "@/stores/selected-passes";
import { MergedNftData } from "@/types";
import { divideByPrecision } from "@bibliothecadao/eternum";
import { useAccount } from "@starknet-react/core";
import { useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Brain, Castle, CirclePlayIcon, UserIcon } from "lucide-react";
import { useMemo } from "react";
import { formatUnits } from "viem";

export const Route = createLazyFileRoute("/")({
  component: Index,
});

function Index() {
  const chain = import.meta.env.VITE_PUBLIC_CHAIN;
  const { address: accountAddress } = useAccount();
  const { togglePass, isSelected } = useSelectedPassesStore("home");
  const { totalPlayers, totalTroops, totalStructures, totalAgents, totalCreatedAgents, isLoading } = useData();

  // Fetch marketplace collection statistics
  const collections = Object.entries(marketplaceCollections);
  const collectionStatisticsQueries = collections.map(([key, collection]) => ({
    queryKey: ["activeMarketOrdersTotal", key],
    queryFn: () => fetchCollectionStatistics(collection.address),
    refetchInterval: 30_000,
  }));

  const userCollectionsQueries = [
    {
      queryKey: ["realmsTokenBalance", accountAddress],
      queryFn: () => (accountAddress ? fetchTokenBalancesWithMetadata(realmsAddress, accountAddress) : null),
      refetchInterval: 8_000,
    },
    {
      queryKey: ["seasonPassTokenBalance", accountAddress],
      queryFn: () => (accountAddress ? fetchTokenBalancesWithMetadata(seasonPassAddress, accountAddress) : null),
      refetchInterval: 8_000,
    },
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
  const seasonPasses = results[1];
  const seasonPassMints = results[2];
  const collectionStats = results.slice(3) as { data: ActiveMarketOrdersTotal[] }[];

  const mintedRealmsCount = useMemo(() => {
    return (
      seasonPassMints.data?.filter((realm) => "season_pass_balance" in realm && realm.season_pass_balance == null)
        .length ?? 0
    );
  }, [seasonPassMints.data]);

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
      <section className="relative h-[60vh] min-h-[500px] flex items-center justify-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/covers/01.png')" }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="relative z-10 text-center px-4">
          <h1 className="text-gold fill-gold">
            <EternumWordsLogo className="mx-auto w-28 fill-current stroke-current sm:w-40 lg:w-60 mb-12" />
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-2xl mx-auto">
            Explore, conquer, and build your legacy in the eternal realm.
          </p>
          <motion.div
            initial={{ scale: 1 }}
            animate={{
              scale: [1, 1.04, 1],
              boxShadow: [
                "0 0 0 1px rgba(255, 215, 0, 0.08)",
                "0 0 0 3px rgba(255, 215, 0, 0.15)",
                "0 0 0 1px rgba(255, 215, 0, 0.08)",
              ],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="inline-block rounded-lg"
          >
            <Button
              size="lg"
              className="text-lg px-8 py-6 relative overflow-hidden group"
              onClick={() =>
                (window.location.href =
                  chain === "sepolia" ? "https://next-eternum.realms.world" : "https://eternum.realms.world")
              }
            >
              <motion.div
                className="absolute inset-0 bg-gold/20"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <CirclePlayIcon className="!w-6 !h-6 mr-2" />
              {chain === "sepolia" ? "Play Now [Sepolia]" : "Play Now"}
            </Button>
          </motion.div>
        </div>

        {/* Statistics Overlay */}
        <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <div className="text-muted-foreground flex items-center gap-2 h-6">
              <UserIcon className="w-5" /> Players
            </div>
            <div className="text-gold font-mono flex items-center h-6">
              {isLoading ? "..." : totalPlayers?.toLocaleString()}
            </div>

            <div className="text-muted-foreground flex items-center gap-2 h-6">
              <Sword className="-ml-1 w-7 fill-muted-foreground -mr-1" />
              Troops
            </div>
            <div className="text-gold font-mono flex items-center h-6">
              {isLoading
                ? "..."
                : divideByPrecision(
                    totalTroops?.reduce((acc, curr) => acc + curr.total_troops, 0) ?? 0,
                  ).toLocaleString()}
            </div>

            <div className="text-muted-foreground flex items-center gap-2 h-6">
              <Castle className="w-5" /> Structures
            </div>
            <div className="text-gold font-mono flex items-center h-6">
              {isLoading
                ? "..."
                : totalStructures?.reduce((acc, curr) => acc + curr.structure_count, 0).toLocaleString()}
            </div>

            <div className="text-muted-foreground flex items-center gap-2 h-6">
              <Brain className="w-5" /> Agents
            </div>
            <div className="text-gold font-mono flex items-center h-6">
              {isLoading ? "..." : `${totalAgents?.toLocaleString()}/${totalCreatedAgents?.toLocaleString()}`}
            </div>
          </div>
        </div>
      </section>

      {/* Action Toolbar */}
      <section className="bg-card/50 border-y">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="text-center sm:text-left">
                <h3 className="text-xl font-bold text-gold">Season 1 Passes Mintable</h3>
                <p className="text-muted-foreground">Claim your passes to start your journey</p>
              </div>
              {accountAddress && (
                <div className="flex items-center gap-2 px-4 py-2 bg-gold/10 rounded-lg">
                  <span className="text-2xl font-bold text-gold">{mintedRealmsCount}</span>
                  <span className="text-muted-foreground">passes remaining</span>
                </div>
              )}
            </div>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/mint">Claim Season Passes</Link>
            </Button>
          </div>
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
              const activeOrders = stats?.active_order_count ?? 0;
              const totalVolume = stats?.open_orders_total_wei
                ? parseFloat(Number(formatUnits(BigInt(stats.open_orders_total_wei), 18)).toFixed(2))
                : "0";
              const floorPrice = stats?.floor_price_wei ? formatUnits(BigInt(stats.floor_price_wei), 18) : "0";
              const MotionLink = motion(Link);

              return (
                <MotionLink
                  to={`/trade/${key}`}
                  key={key}
                  variants={itemVariants}
                  whileHover={{ scale: 1.03 }}
                  className="relative min-h-[300px] bg-cover bg-center rounded-lg shadow-lg overflow-hidden cursor-pointer opacity-75 hover:opacity-100 transition-opacity duration-300 block border border-gold/40"
                  style={{ backgroundImage: `url('${collection.image}')` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 rounded-lg" />
                  <div className="absolute inset-0 bg-black bg-opacity-10 flex flex-col items-start justify-end p-4">
                    <div className="capitalize font-bold text-xl text-gold font-serif">
                      {collection.name.replace(/-/g, " ")}
                    </div>
                    <div className="flex space-x-3 justify-between items-center w-full">
                      <div>
                        <span className="text-muted-foreground mr-1.5">Floor:</span>
                        <span className="font-medium text-lg text-gold">{floorPrice} Lords</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground mr-1.5">Listed:</span>
                        <span className="font-medium text-lg text-gold">{activeOrders}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground mr-1.5">Volume:</span>
                        <span className="font-medium text-lg text-gold">{totalVolume} Lords</span>
                      </div>
                    </div>
                  </div>
                </MotionLink>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* User's Realms and Season Passes */}
      {accountAddress && (
        <section className="py-12 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* Realms Column */}
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-bold">Your Realms</h2>
                  <Button asChild variant="outline">
                    <Link to="/$collection" params={{ collection: "realms" }}>
                      Manage All
                    </Link>
                  </Button>
                </div>
                {realms.data && (
                  <CollectionTokenGrid
                    tokens={realms.data.slice(0, 4) as MergedNftData[]}
                    isCompactGrid={false}
                    pageId="home"
                  />
                )}
              </div>

              {/* Season Passes Column */}
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-bold">Your Season Passes</h2>
                  <Button asChild variant="outline">
                    <Link to="/$collection" params={{ collection: "season-passes" }}>
                      Manage All
                    </Link>
                  </Button>
                </div>
                <CollectionTokenGrid
                  tokens={(seasonPasses.data?.slice(0, 4) ?? []) as MergedNftData[]}
                  isCompactGrid={false}
                  onToggleSelection={togglePass}
                  pageId="home"
                />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
