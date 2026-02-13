import { motion } from "framer-motion";
import { partners } from "@/data/partners";

const partnerRoles: Record<
  string,
  { role: string; capability: string; description: string }
> = {
  Starknet: {
    role: "Execution Layer",
    capability: "Settlement + throughput",
    description:
      "High-frequency onchain gameplay runs on Starknet execution and low-cost transactions.",
  },
  Starkware: {
    role: "ZK Infrastructure",
    capability: "Proof systems",
    description:
      "Core proving research underpins the trust assumptions behind scalable game state.",
  },
  Cartridge: {
    role: "Account Stack",
    capability: "Player onboarding",
    description:
      "Wallet and account abstraction tooling helps players enter games with lower friction.",
  },
  Dojo: {
    role: "Engine Framework",
    capability: "Autonomous worlds",
    description:
      "Entity-component architecture powers composable game logic across the ecosystem.",
  },
};

const capabilityMap = [
  {
    label: "Execution",
    value: "Starknet",
    helper: "State updates and low-latency settlement",
  },
  {
    label: "Proof Stack",
    value: "Starkware",
    helper: "Validity and scaling primitives",
  },
  {
    label: "Engine",
    value: "Dojo",
    helper: "Composable world architecture",
  },
  {
    label: "Player UX",
    value: "Cartridge",
    helper: "Identity, wallet, and onboarding rails",
  },
];

export function PartnersSection() {
  return (
    <section className="realm-section relative overflow-hidden py-16 sm:py-20">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </div>

      <div className="container mx-auto px-4 lg:pr-24 xl:pr-28">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.65 }}
          className="space-y-8 sm:space-y-10"
        >
          <motion.div
            className="mx-auto max-w-3xl space-y-4 text-center"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.6 }}
          >
            <p className="realm-banner">Allied Infrastructure</p>
            <h2 className="realm-title text-3xl sm:text-4xl md:text-5xl">
              Built With Core Partners
            </h2>
            <p className="realm-subtitle text-base sm:text-lg">
              Realms is a stack, not a single app. These protocol partners supply the
              execution, proving, engine, and onboarding rails.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] xl:gap-7"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <article className="realm-panel realm-grid-scan rounded-2xl border border-primary/20 bg-black/35 p-5 sm:p-6">
              <h3 className="realm-banner mb-4">Capability Map</h3>
              <div className="space-y-3">
                {capabilityMap.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-primary/20 bg-black/30 p-3.5"
                  >
                    <p className="realm-sigil mb-1">{item.label}</p>
                    <p className="text-base sm:text-lg font-semibold text-foreground">
                      {item.value}
                    </p>
                    <p className="text-xs text-foreground/70">{item.helper}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="realm-panel rounded-2xl border border-primary/20 bg-black/35 p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="realm-banner">Core Partner Stack</h3>
                <span className="text-[11px] uppercase tracking-[0.14em] text-foreground/60">
                  Protocol Rail Index
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                {partners.map((partner, index) => {
                  const roleInfo = partnerRoles[partner.name];

                  return (
                    <motion.a
                      key={partner.id}
                      href={partner.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group w-full rounded-xl border border-primary/20 bg-black/45 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/55"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.28 + index * 0.07, duration: 0.4 }}
                    >
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="inline-flex h-12 min-w-0 items-center rounded-md border border-primary/20 bg-black/35 px-3">
                          <img
                            src={partner.logo}
                            alt={partner.name}
                            className="h-8 w-full object-contain grayscale opacity-75 transition-all group-hover:grayscale-0 group-hover:opacity-100"
                          />
                        </div>
                        <p className="realm-sigil w-fit justify-self-start whitespace-nowrap sm:justify-self-end">
                          {roleInfo?.role ?? "Ecosystem Partner"}
                        </p>
                      </div>

                      <h4 className="mt-3 text-lg font-semibold text-foreground">{partner.name}</h4>
                      <p className="mt-1 text-xs text-foreground/65">
                        {roleInfo?.capability ?? "Core infrastructure"}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                        {roleInfo?.description ??
                          "Key contributor to the Realms ecosystem stack."}
                      </p>
                    </motion.a>
                  );
                })}
              </div>
            </article>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
