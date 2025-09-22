import { ReactComponent as EternumWordsLogo } from "@/assets/icons/realms-words-logo-g.svg";
import { CollectionCard } from "@/components/modules/collection-card";
import { CollectionTokenGrid } from "@/components/modules/collection-token-grid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Brain, Castle, CirclePlayIcon, Sword, UserIcon } from "lucide-react";

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
  const ownedRealms = (realms.data ?? []) as MergedNftData[];
  const hasRealms = ownedRealms.length > 0;
  const totalRealmCount = ownedRealms.length;
  const featuredRealms = ownedRealms.slice(0, 6) as MergedNftData[];

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
            animate={{
              scale: [1, 1.02, 1],
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
