import { motion } from "framer-motion";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { getLordsInfo } from "@/lib/getLordsPrice";
import { getLordsBalance } from "@/lib/getLordsBalance";
import { stats } from "@/data/stats";
import { AnimatedStat } from "@/components/animated-stat";

export function IntroSection() {
  const { data: lordsInfo } = useQuery(
    queryOptions({
      queryKey: ["lordsPrice"],
      queryFn: getLordsInfo,
    })
  );

  const { data: veLordsSupply } = useQuery(
    queryOptions({
      queryKey: ["veLordsSupply"],
      queryFn: getLordsBalance,
    })
  );

  return (
    <motion.div
      className="min-h-[70vh] container mx-auto px-2 sm:px-4 py-8 sm:py-12 md:py-20 grid grid-cols-1 gap-6 sm:gap-8 md:gap-16 items-start"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Heading and Players Section - now spans full width and text is centered */}
      <div className="space-y-6 sm:space-y-8 md:space-y-12 text-center">
        {/* Title Section */}
        <div className="space-y-3 sm:space-y-4">
          <motion.div
            className="text-3xl sm:text-4xl md:text-6xl font-bold"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <motion.h1
              className="block text-primary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              onchain gaming
            </motion.h1>
          </motion.div>

          <motion.p
            className="text-md sm:text-lg md:text-xl text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            powered by $LORDS
          </motion.p>
        </div>
      </div>

      {/* Stats Section - now appears below the heading section */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1,
            },
          },
        }}
        initial="hidden"
        animate="show"
      >
        {stats.map((baseStat) => {
          let displayValue: number = 0;
          let displayTrend: string = "";

          const priceInfo = lordsInfo?.price as any;
          const lordsInfoData = lordsInfo as any;

          switch (baseStat.id) {
            case "marketCap":
              if (priceInfo?.marketCapUsd) {
                displayValue =
                  typeof priceInfo.marketCapUsd === "string"
                    ? parseFloat(priceInfo.marketCapUsd)
                    : priceInfo.marketCapUsd;
                const trendVal = priceInfo.diff7d;
                if (typeof trendVal === "number") {
                  displayTrend = `${trendVal > 0 ? "+" : ""}${trendVal.toFixed(
                    2
                  )}%`;
                }
              }
              break;
            case "staked":
              if (veLordsSupply !== undefined) {
                displayValue = veLordsSupply;
              }
              displayTrend = baseStat.trend || "";
              break;
            case "volume24h":
              if (priceInfo?.volume24h) {
                displayValue =
                  typeof priceInfo.volume24h === "string"
                    ? parseFloat(priceInfo.volume24h)
                    : priceInfo.volume24h;
                const trendVal = priceInfo.volDiff1;
                if (typeof trendVal === "number") {
                  displayTrend = `${trendVal > 0 ? "+" : ""}${trendVal.toFixed(
                    2
                  )}%`;
                }
              }
              break;
            case "priceChange7d":
              if (priceInfo?.diff7d) {
                const trendValNum =
                  typeof priceInfo.diff7d === "string"
                    ? parseFloat(priceInfo.diff7d)
                    : priceInfo.diff7d;
                displayValue = trendValNum;
                if (typeof trendValNum === "number") {
                  displayTrend = `${
                    trendValNum > 0 ? "+" : ""
                  }${trendValNum.toFixed(2)}%`;
                }
              }
              break;
            case "availableSupply":
              if (priceInfo?.availableSupply) {
                displayValue =
                  typeof priceInfo.availableSupply === "string"
                    ? parseFloat(priceInfo.availableSupply)
                    : priceInfo.availableSupply;
              }
              break;
            case "totalSupply":
              if (lordsInfoData?.totalSupply && lordsInfoData?.decimals) {
                const totalSupplyNum = parseFloat(lordsInfoData.totalSupply);
                const decimalsNum = parseInt(lordsInfoData.decimals);
                if (!isNaN(totalSupplyNum) && !isNaN(decimalsNum)) {
                  displayValue = totalSupplyNum / 10 ** decimalsNum;
                }
              }
              break;
            case "currentPrice":
              if (priceInfo?.rate) {
                displayValue =
                  typeof priceInfo.rate === "string"
                    ? parseFloat(priceInfo.rate)
                    : priceInfo.rate;
                const trendVal = priceInfo.diff;
                if (typeof trendVal === "number") {
                  displayTrend = `${trendVal > 0 ? "+" : ""}${trendVal.toFixed(
                    4
                  )}%`;
                }
              }
              break;
            case "priceChange24h":
              if (priceInfo?.diff) {
                const trendValNum =
                  typeof priceInfo.diff === "string"
                    ? parseFloat(priceInfo.diff)
                    : priceInfo.diff;
                displayValue = trendValNum;
                if (typeof trendValNum === "number") {
                  displayTrend = `${
                    trendValNum > 0 ? "+" : ""
                  }${trendValNum.toFixed(2)}%`;
                }
              }
              break;
            case "tokenHolders":
              if (lordsInfoData?.holdersCount) {
                displayValue =
                  typeof lordsInfoData.holdersCount === "string"
                    ? parseFloat(lordsInfoData.holdersCount)
                    : lordsInfoData.holdersCount;
              }
              break;
            default:
              displayValue = baseStat.value ?? 0;
              displayTrend = baseStat.trend ?? "";
          }

          return (
            <motion.div
              key={baseStat.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    type: "spring",
                    duration: 0.8,
                    bounce: 0.4,
                  },
                },
              }}
            >
              <AnimatedStat
                value={displayValue}
                label={baseStat.label}
                prefix={baseStat.prefix}
                suffix={baseStat.suffix}
                icon={baseStat.icon}
                trend={displayTrend}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
