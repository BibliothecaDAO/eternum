import { ReactComponent as EternumWordsLogo } from "@/assets/icons/realms-words-logo-g.svg";
import { CollectionCard } from "@/components/modules/collection-card";
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
import { useAccount } from "@starknet-react/core";
import { useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CirclePlayIcon } from "lucide-react";

export const Route = createLazyFileRoute("/")({
  component: Index,
});

function Index() {
  const { address: accountAddress } = useAccount();
  const { togglePass } = useSelectedPassesStore("home");
  const { totalPlayers, totalTroops, totalStructures, totalAgents, totalCreatedAgents, isLoading } = useData();

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
  // const seasonPasses = results[1];
  //const seasonPassMints = results[2];
  const collectionStats = results.slice(3) as { data: ActiveMarketOrdersTotal[] }[];

  /* const mintedRealmsCount = useMemo(() => {
    return (
      seasonPassMints.data?.filter((realm) => "season_pass_balance" in realm && realm.season_pass_balance == null)
        .length ?? 0
    );
  }, [seasonPassMints.data]);*/

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
            <EternumWordsLogo className="mx-auto w-60 fill-current stroke-current sm:w-72 lg:w-96 mb-16" />
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-2xl mx-auto">
            Explore, conquer, and build your legacy in Realms: Blitz
          </p>
          <motion.div
            initial={{ scale: 1 }}
            className="inline-flex flex-col items-center gap-3 rounded-lg"
          >
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
            <p className="text-sm text-muted-foreground">
              Both versions currently run on testnet.
            </p>
          </motion.div>
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
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
