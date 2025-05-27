import { FullPageLoader } from "@/components/modules/full-page-loader";
import { marketplaceCollections } from "@/config";
import { fetchActiveMarketOrdersTotal } from "@/hooks/services";
import { useSuspenseQueries } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { formatUnits } from "viem";

export const Route = createLazyFileRoute("/trade/")({
  component: CollectionsPage,
  pendingComponent: FullPageLoader,
});

function CollectionsPage() {
  const collections = Object.entries(marketplaceCollections);
  const queries = collections.map(([key, collection]) => ({
    queryKey: ["activeMarketOrdersTotal", key],
    queryFn: () => fetchActiveMarketOrdersTotal(collection.address),
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
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Marketplace Collections</h1>
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        layout
      >
        {collections.map(([key, collection], index) => {
          const stats = results[index].data?.[0];
          const activeOrders = stats?.active_order_count ?? 0;
          const totalVolume = stats?.open_orders_total_wei ? formatUnits(BigInt(stats.open_orders_total_wei), 18) : "0";
          const MotionLink = motion(Link);
          const commonProps = {
            className: `relative min-h-[300px] bg-cover bg-center rounded-lg shadow-lg overflow-hidden cursor-pointer opacity-75 hover:opacity-100 transition-opacity duration-300 block border border-gold/40`,
            style: { backgroundImage: `url('${collection.image}')` },
          };
          return (
            <MotionLink
              to={`/trade/${key}`}
              key={key}
              variants={itemVariants}
              whileHover={{ scale: 1.03 }}
              {...commonProps}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 rounded-lg"></div>
              <div className="absolute inset-0 bg-black bg-opacity-10 flex flex-col items-start justify-end p-4">
                <div className="capitalize font-bold text-xl text-gold font-serif">
                  {collection.name.replace(/-/g, " ")}
                </div>
                <div>
                  <div className="flex space-x-3 justify-between items-center">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground mr-1.5">Listed:</span>
                      <span className="font-medium text-gold">{activeOrders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground mr-1.5">Volume:</span>
                      <span className="font-medium text-gold">{totalVolume} Lords</span>
                    </div>
                  </div>
                </div>
              </div>
            </MotionLink>
          );
        })}
      </motion.div>
    </div>
  );
}
