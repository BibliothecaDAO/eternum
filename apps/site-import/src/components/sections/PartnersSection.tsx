import { motion } from "framer-motion";
import { partners } from "@/data/partners";

const partnerRoles: Record<string, string> = {
  Starknet: "Execution Layer",
  Starkware: "ZK Infrastructure",
  Cartridge: "Account Stack",
  Dojo: "Engine Framework",
};

export function PartnersSection() {
  return (
    <section className="realm-section relative overflow-hidden py-16 sm:py-20">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </div>

      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.65 }}
          className="space-y-8"
        >
          <p className="realm-banner text-center">Built With</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {partners.map((partner, index) => (
              <motion.a
                key={partner.id}
                href={partner.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center gap-3 rounded-xl border border-primary/20 bg-black/30 p-5 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/55"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.07, duration: 0.4 }}
              >
                <div className="h-10 w-full flex items-center justify-center">
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    className="h-8 max-w-full object-contain grayscale opacity-75 transition-all group-hover:grayscale-0 group-hover:opacity-100"
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">{partner.name}</p>
                  <p className="text-xs text-foreground/60">
                    {partnerRoles[partner.name] ?? "Ecosystem Partner"}
                  </p>
                </div>
              </motion.a>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
