import { ActiveMarketOrdersTotal } from "@/hooks/services";
import { Link } from "@tanstack/react-router";
import { motion, Variants } from "framer-motion";
import { formatUnits } from "viem";

interface CollectionCardProps {
  collectionKey: string;
  collection: {
    name: string;
    image: string;
  };
  stats?: ActiveMarketOrdersTotal;
  variants: Variants;
}

export function CollectionCard({ collectionKey, collection, stats, variants }: CollectionCardProps) {
  const activeOrders = stats?.active_order_count ?? 0;
  const totalVolume = stats?.open_orders_total_wei
    ? parseFloat(Number(formatUnits(BigInt(stats.open_orders_total_wei), 18)).toFixed(2))
    : "0";
  const floorPrice = stats?.floor_price_wei
    ? parseFloat(Number(formatUnits(BigInt(stats.floor_price_wei), 18)).toFixed(2)).toLocaleString()
    : "0";
  const MotionLink = motion(Link);

  return (
    <MotionLink
      to={`/collection/${collectionKey}`}
      key={collectionKey}
      variants={variants}
      whileHover={{ scale: 1.03 }}
      className="relative min-h-[300px] bg-cover bg-center rounded-lg shadow-lg overflow-hidden cursor-pointer opacity-75 hover:opacity-100 transition-opacity duration-300 block border border-gold/40"
      style={{ backgroundImage: `url('${collection.image}')` }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 rounded-lg" />
      <div className="absolute inset-0 bg-black bg-opacity-10 flex flex-col items-start justify-end p-4">
        <div className="capitalize font-bold text-xl text-gold font-serif">{collection.name.replace(/-/g, " ")}</div>
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
}
