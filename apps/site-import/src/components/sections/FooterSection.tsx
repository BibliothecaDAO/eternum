import { socials } from "@/data/socials";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ComponentType, useEffect, useRef, useState } from "react";
import {
  lordsInfoQueryOptions,
  treasuryBalanceQueryOptions,
} from "@/lib/query-options";
import {
  Coins,
  Users,
  Gamepad2,
  TrendingUp,
  ExternalLink,
  Github,
  ShoppingBag,
} from "lucide-react";
import { games } from "@/data/games";

function DeferredApyValue() {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [ApyValue, setApyValue] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (shouldLoad) return;

    const node = wrapperRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [shouldLoad]);

  useEffect(() => {
    if (!shouldLoad || ApyValue) return;

    import("./FooterApyValue").then((module) => {
      setApyValue(() => module.FooterApyValue);
    });
  }, [ApyValue, shouldLoad]);

  return <span ref={wrapperRef}>{ApyValue ? <ApyValue /> : "12.5%"}</span>;
}

export function FooterSection() {
  const liveGameCount = games.filter((game) => game.isLive).length;
  const totalGameCount = games.length;

  // Fetch live data
  const { data: lordsInfo } = useQuery(lordsInfoQueryOptions());

  const { data: treasuryBalance } = useQuery(treasuryBalanceQueryOptions());

  const totalTreasuryValue = treasuryBalance
    ? treasuryBalance.LORDS.usdValue +
      treasuryBalance.ETH.usdValue +
      treasuryBalance.WETH.usdValue +
      treasuryBalance.USDC.usdValue
    : 0;

  // Key metrics
  const keyMetrics = [
    {
      icon: Coins,
      label: "Market Cap",
      value: lordsInfo?.price?.marketCapUsd
        ? `$${(parseFloat(lordsInfo.price.marketCapUsd) / 1000000).toFixed(1)}M`
        : "Loading...",
      color: "text-green-500",
    },
    {
      icon: TrendingUp,
      label: "veLORDS APY",
      value: <DeferredApyValue />,
      color: "text-blue-500",
    },
    {
      icon: Users,
      label: "DAO Treasury",
      value: totalTreasuryValue
        ? `$${(totalTreasuryValue / 1000000).toFixed(1)}M`
        : "Loading...",
      color: "text-purple-500",
    },
    {
      icon: Gamepad2,
      label: "Game Coverage",
      value: `${liveGameCount}/${totalGameCount}`,
      color: "text-orange-500",
    },
  ];

  const quickLinks = [
    {
      title: "Developers",
      links: [
        {
          label: "GitHub",
          href: "https://github.com/BibliothecaDAO",
          icon: Github,
        },
        {
          label: "Brand Assets",
          href: "https://drive.google.com/drive/folders/17vrwIjwqifxBVTkHmxoK1VhQ31hVSbDH",
          icon: ExternalLink,
        },
      ],
    },
    {
      title: "Community",
      links: [
        {
          label: "Discord",
          href: "https://discord.gg/realmsworld",
          icon: ExternalLink,
        },
        {
          label: "Twitter",
          href: "https://twitter.com/LordsRealms",
          icon: ExternalLink,
        },
      ],
    },
    {
      title: "Ecosystem",
      links: [
        {
          label: "Realms Shop",
          href: "https://shop.realms.world",
          icon: ShoppingBag,
        },
        {
          label: "Frontinus House",
          href: "https://snapshot.box/#/sn:0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62",
          icon: ExternalLink,
        },
      ],
    },
  ];

  return (
    <footer className="relative mt-24 bg-gradient-to-b from-background to-background/50">
      {/* Decorative top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="container mx-auto px-4">
        {/* Key Metrics Section */}
        <motion.div
          className="py-12 grid grid-cols-2 md:grid-cols-4 gap-6 realm-panel p-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          {keyMetrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              className="text-center card-relic"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <metric.icon className={`w-8 h-8 mx-auto mb-2 ${metric.color}`} />
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="text-sm text-muted-foreground">
                {metric.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        <div className="border-t border-border/50 mt-4" />

        {/* Main Footer Content */}
        <div className="py-16">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            {/* Brand Column */}
            <motion.div
              className="lg:col-span-1 space-y-6"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div>
                <img
                  src="/rw-logo.svg"
                  alt="Realms World"
                  className="w-20 mb-4"
                />
                <h3 className="realm-title text-2xl font-bold mb-2">Realms World</h3>
                <p className="text-muted-foreground">
                  Building the future of onchain gaming with $LORDS
                </p>
              </div>

              {/* Social Links */}
              <div className="flex space-x-4">
                {socials.map((social) => (
                  <motion.a
                    key={social.id}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/20 transition-all"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5 fill-current"
                      aria-hidden="true"
                    >
                      <path d={social.icon} />
                    </svg>
                    <span className="sr-only">{social.name}</span>
                  </motion.a>
                ))}
              </div>
            </motion.div>

            {/* Quick Links */}
            {quickLinks.map((section, sectionIndex) => (
              <motion.div
                key={section.title}
                className="space-y-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: sectionIndex * 0.1 }}
                viewport={{ once: true }}
              >
                <h4 className="font-bold text-lg">{section.title}</h4>
                <ul className="space-y-3">
                  {section.links.map((link) => {
                    const Icon = link.icon;
                    return (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group"
                        >
                          <Icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          <span>{link.label}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>© {new Date().getFullYear()} BibliothecaDAO</span>
              <span className="hidden md:inline">•</span>
              <span className="hidden md:inline">
                Building the future of onchain gaming
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6 text-sm">
              <a
                href="/scroll"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Scroll
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Privacy Policy
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Terms of Service
              </a>
              <a
                href="https://status.realms.world"
                className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                All Systems Operational
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
