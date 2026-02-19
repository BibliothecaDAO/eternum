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
import { Link } from "@tanstack/react-router";

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

  const { data: lordsInfo } = useQuery(lordsInfoQueryOptions());
  const { data: treasuryBalance } = useQuery(treasuryBalanceQueryOptions());

  const totalTreasuryValue = treasuryBalance
    ? treasuryBalance.LORDS.usdValue +
      treasuryBalance.ETH.usdValue +
      treasuryBalance.WETH.usdValue +
      treasuryBalance.USDC.usdValue
    : 0;

  const keyMetrics = [
    {
      icon: Coins,
      label: "Market Cap",
      sublabel: "LORDS",
      value: lordsInfo?.price?.marketCapUsd
        ? `$${(parseFloat(lordsInfo.price.marketCapUsd) / 1000000).toFixed(1)}M`
        : "...",
    },
    {
      icon: TrendingUp,
      label: "veLORDS APY",
      sublabel: "Staking",
      value: <DeferredApyValue />,
    },
    {
      icon: Users,
      label: "DAO Treasury",
      sublabel: "Multi-asset",
      value: totalTreasuryValue
        ? `$${(totalTreasuryValue / 1000000).toFixed(1)}M`
        : "...",
    },
    {
      icon: Gamepad2,
      label: "Game Coverage",
      sublabel: "Live / Total",
      value: `${liveGameCount}/${totalGameCount}`,
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
          href: "https://x.com/LootRealms",
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
    <footer className="relative realm-section hex-grid-texture overflow-hidden">
      {/* Atmospheric top wash */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[var(--realm-accent-brass)]/[0.03] to-transparent pointer-events-none" />

      <div className="container relative mx-auto px-4">
        {/* Key Metrics */}
        <motion.div
          className="realm-panel p-2 sm:p-3"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            {keyMetrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                className="relative group text-center py-5 px-3 rounded-lg border border-[var(--realm-border-etched)]/50 bg-gradient-to-b from-[var(--realm-bg-smoke)]/30 to-transparent transition-all duration-300 hover:border-[var(--realm-accent-brass)]/50 hover:bg-[var(--realm-bg-smoke)]/40"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                viewport={{ once: true }}
              >
                <metric.icon className="w-5 h-5 mx-auto mb-2 text-[var(--realm-accent-brass)]/70 group-hover:text-[var(--realm-accent-brass)] transition-colors" />
                <div className="text-xl sm:text-2xl font-bold font-serif text-foreground tracking-tight">
                  {metric.value}
                </div>
                <div
                  className="text-[10px] uppercase tracking-[0.18em] mt-1 text-[var(--realm-accent-brass)]/60"
                  style={{ fontFamily: "var(--font-ui)" }}
                >
                  {metric.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Divider with glow */}
        <div className="relative my-10">
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--realm-border-etched)]/60 to-transparent" />
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-24 h-2 bg-[var(--realm-accent-brass)]/10 blur-md rounded-full" />
        </div>

        {/* Main Footer Content */}
        <div className="pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-8">
            {/* Brand Column */}
            <motion.div
              className="lg:col-span-2 space-y-6"
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div>
                <img
                  src="/rw-logo.svg"
                  alt="Realms World"
                  className="w-16 mb-5 opacity-90"
                />
                <h3 className="realm-title text-3xl mb-3">Realms World</h3>
                <p className="text-muted-foreground leading-relaxed max-w-sm">
                  The autonomous onchain gaming ecosystem powered by $LORDS.
                  Built by BibliothecaDAO.
                </p>
              </div>

              {/* Social Links */}
              <div className="flex gap-2">
                {socials.map((social) => (
                  <motion.a
                    key={social.id}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg border border-[var(--realm-border-etched)]/50 bg-[var(--realm-bg-smoke)]/30 flex items-center justify-center text-muted-foreground hover:text-[var(--realm-accent-brass)] hover:border-[var(--realm-accent-brass)]/50 hover:bg-[var(--realm-bg-smoke)]/50 transition-all duration-200"
                    whileHover={{ scale: 1.08, y: -1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4 fill-current"
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
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 + sectionIndex * 0.08 }}
                viewport={{ once: true }}
              >
                <h4
                  className="text-[11px] uppercase tracking-[0.2em] text-[var(--realm-accent-brass)]/70 mb-4"
                  style={{ fontFamily: "var(--font-ui)" }}
                >
                  {section.title}
                </h4>
                <ul className="space-y-2.5">
                  {section.links.map((link) => {
                    const Icon = link.icon;
                    return (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-[var(--realm-accent-brass)] transition-colors duration-200 group"
                        >
                          <Icon className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
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
        <div className="py-5 border-t border-[var(--realm-border-etched)]/40">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div
              className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60"
              style={{ fontFamily: "var(--font-ui)" }}
            >
              <span>&copy; {new Date().getFullYear()} BibliothecaDAO</span>
              <span className="hidden md:inline text-[var(--realm-border-etched)]">
                /
              </span>
              <span className="hidden md:inline">Onchain since 2021</span>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-5 text-xs text-muted-foreground/50">
              <Link
                to="/scroll"
                className="hover:text-[var(--realm-accent-brass)] transition-colors duration-200"
              >
                Scroll
              </Link>
              <Link
                to="/privacy"
                className="hover:text-[var(--realm-accent-brass)] transition-colors duration-200"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="hover:text-[var(--realm-accent-brass)] transition-colors duration-200"
              >
                Terms
              </Link>
              <a
                href="https://status.realms.world"
                className="hover:text-[var(--realm-accent-brass)] transition-colors duration-200 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_6px_var(--realm-accent-brass)]" />
                Operational
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
