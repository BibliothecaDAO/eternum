import { motion } from "framer-motion";
import { TokenomicsChart } from "@/components/TokenomicsChart";

export function TokenomicsSection() {
  return (
    <section className="flex items-center container mx-auto px-4 py-8 sm:py-16">
      <motion.div
        className="w-full space-y-6 sm:space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Header */}
        <motion.div
          className="space-y-3 sm:space-y-4 sm:text-left sm:mx-0 text-center"
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-center">
            Tokenomics
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground text-center">
            $LORDS token powers the entire gaming ecosystem, providing value{" "}
            <br />
            through staking, gameplay rewards, and governance.
          </p>
        </motion.div>

        <motion.div
          className="w-full"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <TokenomicsChart />
        </motion.div>
      </motion.div>
    </section>
  );
}
