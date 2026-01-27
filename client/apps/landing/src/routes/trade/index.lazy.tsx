import { CollectionCard } from "@/components/modules/collection-card";
import { FullPageLoader } from "@/components/modules/full-page-loader";
import { marketplaceCollections } from "@/config";
import { fetchCollectionStatistics } from "@/hooks/services";
import { useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";

export const Route = createLazyFileRoute("/trade/")({
  component: CollectionsPage,
  pendingComponent: FullPageLoader,
});

function CollectionsPage() {
  const collections = Object.entries(marketplaceCollections).filter(([key, collection]) => collection.address != "");
  const queries = collections.map(([key, collection]) => ({
    queryKey: ["activeMarketOrdersTotal", key],
    queryFn: () => fetchCollectionStatistics(collection.address),
    refetchInterval: 30_000,
  }));

  const results = useSuspenseQueries({
    queries,
  });

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
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Marketplace Collections</h1>
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24 "
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        layout
      >
        {collections.map(([key, collection], index) => {
          const stats = results[index].data?.[0];
          return (
            <CollectionCard
              key={key}
              collectionKey={key}
              collection={collection}
              stats={stats}
              variants={itemVariants}
            />
          );
        })}
      </motion.div>
    </div>
  );
}
