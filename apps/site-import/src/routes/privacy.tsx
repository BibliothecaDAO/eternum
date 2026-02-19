import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { generateMetaTags } from "@/lib/og-image";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: generateMetaTags({
      title: "Privacy Policy - Realms World",
      description:
        "Privacy policy for Realms World — how we handle your data across our onchain gaming ecosystem.",
      path: "/privacy",
    }),
  }),
});

function PrivacyPage() {
  return (
    <div className="hex-grid-texture min-h-screen">
      <section className="relative py-24 sm:py-32">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-primary transition-colors mb-8"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>

            <p className="realm-banner mb-4">Legal</p>
            <h1 className="realm-title text-3xl sm:text-5xl mb-4">
              Privacy Policy
            </h1>
            <p className="text-foreground/60 text-sm mb-12">
              Last updated: February 2025
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="prose prose-invert prose-sm max-w-none space-y-8"
          >
            <div className="realm-panel rounded-xl border border-primary/15 p-6 sm:p-8 space-y-8">
              <Section title="1. Introduction">
                <p>
                  Realms World ("we," "us," or "our") is operated by
                  BibliothecaDAO. This Privacy Policy explains how we collect,
                  use, and protect information when you use our website at
                  realms.world and related services (collectively, the
                  "Services").
                </p>
                <p>
                  Our Services interact with public blockchain networks
                  (primarily Starknet and Ethereum). On-chain transactions are
                  public by design and are not covered by this policy.
                </p>
              </Section>

              <Section title="2. Information We Collect">
                <h4 className="text-foreground/90 font-semibold text-sm mt-4 mb-2">
                  Information You Provide
                </h4>
                <ul>
                  <li>
                    Wallet addresses when you connect to our Services
                  </li>
                  <li>
                    Communications you send us (e.g., support requests via
                    Discord)
                  </li>
                  <li>
                    Feedback, proposals, or governance votes submitted through
                    the DAO
                  </li>
                </ul>

                <h4 className="text-foreground/90 font-semibold text-sm mt-4 mb-2">
                  Information Collected Automatically
                </h4>
                <ul>
                  <li>
                    Device and browser information (type, operating system,
                    screen resolution)
                  </li>
                  <li>
                    IP address and approximate geographic location
                  </li>
                  <li>
                    Usage data (pages visited, time spent, referral source)
                  </li>
                  <li>
                    Performance and error data to improve reliability
                  </li>
                </ul>

                <h4 className="text-foreground/90 font-semibold text-sm mt-4 mb-2">
                  Blockchain Data
                </h4>
                <p>
                  When you interact with on-chain games or contracts, your
                  wallet address and transaction history are recorded on the
                  public blockchain. This data is inherently public and
                  immutable. We may index and display this data within our
                  Services.
                </p>
              </Section>

              <Section title="3. How We Use Your Information">
                <ul>
                  <li>Provide, maintain, and improve our Services</li>
                  <li>
                    Display game data, leaderboards, and treasury information
                  </li>
                  <li>Process governance proposals and DAO operations</li>
                  <li>Detect and prevent fraud or abuse</li>
                  <li>Communicate service updates and announcements</li>
                  <li>Comply with legal obligations</li>
                </ul>
              </Section>

              <Section title="4. Information Sharing">
                <p>
                  We do not sell your personal information. We may share data
                  in the following circumstances:
                </p>
                <ul>
                  <li>
                    <strong>Service Providers:</strong> Third-party analytics
                    and infrastructure providers that help us operate the
                    Services
                  </li>
                  <li>
                    <strong>On-chain:</strong> Transaction data submitted to
                    blockchain networks is publicly visible
                  </li>
                  <li>
                    <strong>Legal Requirements:</strong> When required by law,
                    regulation, or legal process
                  </li>
                  <li>
                    <strong>Safety:</strong> To protect the rights, property,
                    or safety of our users or the public
                  </li>
                </ul>
              </Section>

              <Section title="5. Third-Party Services">
                <p>Our Services integrate with third-party platforms including:</p>
                <ul>
                  <li>
                    <strong>Cartridge</strong> — Session key wallet
                    infrastructure for game interactions
                  </li>
                  <li>
                    <strong>Starknet / Ethereum</strong> — Public blockchain
                    networks for on-chain game execution
                  </li>
                  <li>
                    <strong>Snapshot</strong> — Governance voting platform
                  </li>
                </ul>
                <p>
                  These services have their own privacy policies. We encourage
                  you to review them.
                </p>
              </Section>

              <Section title="6. Data Retention">
                <p>
                  We retain collected information for as long as necessary to
                  provide our Services and fulfill the purposes described in
                  this policy. On-chain data is permanent and cannot be
                  deleted due to the immutable nature of blockchain technology.
                </p>
              </Section>

              <Section title="7. Security">
                <p>
                  We implement reasonable technical and organizational measures
                  to protect information under our control. However, no system
                  is perfectly secure. We cannot guarantee the absolute
                  security of your information.
                </p>
              </Section>

              <Section title="8. Your Rights">
                <p>
                  Depending on your jurisdiction, you may have the right to:
                </p>
                <ul>
                  <li>Access the personal data we hold about you</li>
                  <li>Request correction of inaccurate data</li>
                  <li>Request deletion of your data (where technically feasible)</li>
                  <li>Object to or restrict processing of your data</li>
                  <li>Data portability</li>
                </ul>
                <p>
                  Note that on-chain data cannot be modified or deleted due to
                  blockchain immutability. To exercise your rights regarding
                  off-chain data, contact us via Discord.
                </p>
              </Section>

              <Section title="9. Cookies and Tracking">
                <p>
                  We use minimal cookies and local storage necessary for the
                  functioning of our Services, including:
                </p>
                <ul>
                  <li>Session and wallet connection state</li>
                  <li>Theme and display preferences</li>
                  <li>Basic analytics to understand site usage</li>
                </ul>
                <p>
                  We do not use third-party advertising cookies or cross-site
                  tracking.
                </p>
              </Section>

              <Section title="10. Children">
                <p>
                  Our Services are not directed to individuals under 18. We do
                  not knowingly collect personal information from children. If
                  you believe a child has provided us with personal
                  information, please contact us.
                </p>
              </Section>

              <Section title="11. Changes to This Policy">
                <p>
                  We may update this Privacy Policy from time to time. We will
                  notify users of material changes by updating the "Last
                  updated" date and posting the revised policy on this page.
                </p>
              </Section>

              <Section title="12. Contact">
                <p>
                  For privacy-related questions or requests, reach us through:
                </p>
                <ul>
                  <li>
                    Discord:{" "}
                    <a
                      href="https://discord.gg/realmsworld"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 transition-colors"
                    >
                      discord.gg/realmsworld
                    </a>
                  </li>
                  <li>
                    GitHub:{" "}
                    <a
                      href="https://github.com/BibliothecaDAO"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 transition-colors"
                    >
                      github.com/BibliothecaDAO
                    </a>
                  </li>
                </ul>
              </Section>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="realm-title text-lg">{title}</h3>
      <div className="text-foreground/75 text-sm leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-foreground/90">
        {children}
      </div>
    </div>
  );
}
