import { motion } from "framer-motion";
import { partners } from "@/data/partners";

export function PartnersSection() {
  return (
    <section className="relative py-16 sm:py-20">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </div>

      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7 }}
          className="space-y-10"
        >
          <motion.div
            className="text-center max-w-3xl mx-auto space-y-4"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.7 }}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-primary/90">
              Allied Infrastructure
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl">
              Built With Core Partners
            </h2>
            <p className="text-base sm:text-lg text-foreground/75">
              Realms operates with the core protocols and teams powering
              onchain worlds.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 items-stretch"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            {partners.map((partner, index) => (
              <motion.a
                key={partner.id}
                href={partner.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center justify-center rounded-xl border border-primary/20 bg-black/30 px-4 py-6 sm:py-8 hover:border-primary/50 transition-colors"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + index * 0.08, duration: 0.45 }}
                whileHover={{ y: -2 }}
              >
                <img
                  src={partner.logo}
                  alt={partner.name}
                  className="h-8 sm:h-10 w-auto object-contain grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
                />
                <span className="mt-3 text-xs uppercase tracking-[0.14em] text-foreground/70 group-hover:text-primary transition-colors">
                  {partner.name}
                </span>
              </motion.a>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
