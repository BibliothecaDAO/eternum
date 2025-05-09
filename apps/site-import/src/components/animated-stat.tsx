import { motion } from "framer-motion";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

import { useCountAnimation } from "@/components/use-count-animation";

export function AnimatedStat({
  value,
  label,
  prefix = "",
  suffix = "",
  icon,
  trend,
}: {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  icon: string;
  trend: string;
}) {
  const count = useCountAnimation(value);
  const isPositiveTrend = trend.startsWith("+");

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <Card className="backdrop-blur-md transition-all duration-300 group flex flex-col h-full">
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
              className="w-6 h-6"
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
              variants={{
                initial: { y: 0 },
                hover: { y: -5 },
              }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <CardTitle className="text-2xl sm:text-3xl">
                {prefix}
                {count.toLocaleString()}
                {suffix}
              </CardTitle>
            </motion.div>
            <motion.div
              variants={{
                initial: { opacity: 0.7, y: 0 },
                hover: { opacity: 1, y: -5 },
              }}
              transition={{ type: "spring", stiffness: 400 }}
              className={` ${
                isPositiveTrend ? "text-positive" : "text-destructive"
              }`}
            >
              {trend || "\u00A0"}
            </motion.div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
