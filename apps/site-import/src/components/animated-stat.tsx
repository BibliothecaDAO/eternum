import { motion } from "framer-motion";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

import { useCountAnimation } from "@/components/use-count-animation";

interface AnimatedStatProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  icon: string;
  trend: string;
}

// Format number based on its size for better readability
function formatValue(value: number, animatedCount: number): string {
  // For very small values (0-1), show more decimal places
  if (value > 0 && value < 1) {
    return Number(animatedCount.toFixed(4)).toLocaleString();
  }

  // For percentage values, show 1 decimal
  if (value < 100) {
    return Number(animatedCount.toFixed(1)).toLocaleString();
  }

  // For large numbers, use compact notation
  if (value >= 1000000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(animatedCount);
  }

  // Default formatting
  return Number(animatedCount.toFixed(0)).toLocaleString();
}

// Animation variants for cleaner code
const hoverVariants = {
  initial: { y: 0 },
  hover: { y: -5 },
};

const trendVariants = {
  initial: { opacity: 0.7, y: 0 },
  hover: { opacity: 1, y: -5 },
};

export function AnimatedStat({
  value,
  label,
  prefix = "",
  suffix = "",
  icon,
  trend,
}: AnimatedStatProps) {
  const animatedCount = useCountAnimation(value);
  const isPositiveTrend = trend.startsWith("+");
  const formattedValue = formatValue(value, animatedCount);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <Card className="backdrop-blur-md transition-all duration-300 group flex flex-col h-full border rounded-xl">
        <CardHeader className="pb-2 uppercase">
          <div className="flex items-center justify-between mb-8">
            <CardDescription className="text-base sm:text-lg font-medium">
              <motion.h3
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {label}
              </motion.h3>
            </CardDescription>
            <motion.svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6 text-muted-foreground"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </motion.svg>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 flex flex-col flex-grow justify-end">
          <motion.div initial="initial" whileHover="hover" animate="initial">
            <motion.div
              variants={hoverVariants}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <CardTitle className="text-2xl sm:text-3xl font-bold">
                {prefix}
                {formattedValue}
                {suffix}
              </CardTitle>
            </motion.div>

            {trend && (
              <motion.div
                variants={trendVariants}
                transition={{ type: "spring", stiffness: 400 }}
                className={`text-sm font-medium mt-1 ${
                  isPositiveTrend ? "text-green-500" : "text-red-500"
                }`}
              >
                {trend}
              </motion.div>
            )}
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
