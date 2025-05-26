import { motion } from "framer-motion";

// Partner data - replace with actual partner logos
const partners = [
  {
    name: "Starknet",
    logo: "/partners/Starknet.svg",
    url: "https://starknet.io",
  },
  {
    name: "Starkware",
    logo: "/partners/Starkware.svg",
    url: "https://starkware.co",
  },
  {
    name: "Dojo",
    logo: "/partners/dojo-logo.svg",
    url: "https://dojoengine.org",
  },
  {
    name: "Cartridge",
    logo: "/partners/Cartridge.svg",
    url: "https://cartridge.gg",
  },
];

export function PartnersSection() {
  return (
    <section className="py-16 sm:py-24 bg-background/50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="space-y-12"
        >
          {/* Header */}
          <motion.div
            className="text-center max-w-3xl mx-auto space-y-4"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold">Trusted Partners</h2>
            <p className="text-lg text-muted-foreground">
              Building the future of onchain gaming together with industry
              leaders
            </p>
          </motion.div>

          {/* Partners Grid */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            {partners.map((partner, index) => (
              <motion.a
                key={partner.name}
                href={partner.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-center p-6 rounded-lg bg-background border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1, duration: 0.6 }}
                whileHover={{ scale: 1.05 }}
              >
                <img
                  src={partner.logo}
                  alt={partner.name}
                  className="h-8 w-auto object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300 opacity-60 group-hover:opacity-100"
                  onError={(e) => {
                    // Fallback to text if logo doesn't load
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const textFallback = document.createElement("div");
                    textFallback.className =
                      "text-lg font-semibold text-muted-foreground group-hover:text-primary transition-colors";
                    textFallback.textContent = partner.name;
                    target.parentElement?.appendChild(textFallback);
                  }}
                />
              </motion.a>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
