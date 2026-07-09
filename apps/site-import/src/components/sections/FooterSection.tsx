import { socials } from "@/data/socials";
import { motion } from "framer-motion";
import { ExternalLink, Github } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function FooterSection() {
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
