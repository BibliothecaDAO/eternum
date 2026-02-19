import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { generateMetaTags } from "@/lib/og-image";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: generateMetaTags({
      title: "Terms of Service - Realms World",
      description:
        "Terms of Service for Realms World — the rules governing your use of our onchain gaming ecosystem.",
      path: "/terms",
    }),
  }),
});

function TermsPage() {
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
              Terms of Service
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
              <Section title="1. Acceptance of Terms">
                <p>
                  By accessing or using Realms World (realms.world) and its
                  associated services, games, and smart contracts
                  (collectively, the "Services"), you agree to be bound by
                  these Terms of Service ("Terms"). The Services are operated
                  by BibliothecaDAO and its contributors.
                </p>
                <p>
                  If you do not agree to these Terms, do not use the Services.
                </p>
              </Section>

              <Section title="2. Eligibility">
                <ul>
                  <li>You must be at least 18 years of age to use the Services.</li>
                  <li>
                    You must not be located in, or a resident of, any
                    jurisdiction where access to blockchain-based services or
                    digital assets is prohibited.
                  </li>
                  <li>
                    You are responsible for ensuring compliance with all
                    applicable laws in your jurisdiction.
                  </li>
                </ul>
              </Section>

              <Section title="3. Description of Services">
                <p>
                  Realms World provides a web interface to interact with
                  on-chain games, governance tools, and ecosystem resources
                  built on the Starknet and Ethereum blockchains. The Services
                  include but are not limited to:
                </p>
                <ul>
                  <li>
                    Access to on-chain games (Eternum, Blitz, Loot Survivor,
                    and others)
                  </li>
                  <li>$LORDS token staking (veLORDS)</li>
                  <li>DAO governance participation via Frontinus House</li>
                  <li>Game leaderboards, statistics, and ecosystem data</li>
                  <li>Blog content and ecosystem updates (Scroll)</li>
                </ul>
              </Section>

              <Section title="4. Blockchain Interactions">
                <p>
                  <strong>Irreversibility.</strong> Transactions submitted to
                  blockchain networks are irreversible. Once confirmed, they
                  cannot be cancelled, reversed, or refunded. You are solely
                  responsible for reviewing transaction details before
                  confirming.
                </p>
                <p>
                  <strong>Gas Fees.</strong> Blockchain transactions require
                  gas fees paid in the native token of the network (e.g., ETH
                  on Ethereum, STRK on Starknet). These fees are paid to
                  network validators, not to us.
                </p>
                <p>
                  <strong>Smart Contract Risk.</strong> The Services interact
                  with smart contracts deployed on public blockchains. While
                  these contracts are open-source and auditable, they may
                  contain bugs or vulnerabilities. You interact with smart
                  contracts at your own risk.
                </p>
                <p>
                  <strong>Wallet Security.</strong> You are responsible for
                  maintaining the security of your wallet and private keys. We
                  never have access to your private keys and cannot recover
                  lost funds.
                </p>
              </Section>

              <Section title="5. $LORDS Token and Digital Assets">
                <p>
                  $LORDS is a utility token used within the Realms ecosystem
                  for game entry, marketplace transactions, governance, and
                  staking. By using $LORDS or any digital assets through our
                  Services:
                </p>
                <ul>
                  <li>
                    You acknowledge that digital assets are volatile and may
                    lose value.
                  </li>
                  <li>
                    You understand that we do not guarantee the value,
                    liquidity, or transferability of any digital asset.
                  </li>
                  <li>
                    You accept that game rewards, staking yields, and other
                    incentives are subject to change based on protocol
                    mechanics and DAO governance.
                  </li>
                </ul>
              </Section>

              <Section title="6. Game Rules and Fair Play">
                <p>When participating in on-chain games you agree to:</p>
                <ul>
                  <li>
                    Abide by the rules and mechanics of each game as defined
                    by its smart contracts
                  </li>
                  <li>
                    Not exploit bugs, vulnerabilities, or unintended behaviors
                    for unfair advantage
                  </li>
                  <li>
                    Report any discovered vulnerabilities through responsible
                    disclosure to the development team
                  </li>
                  <li>
                    Accept that game outcomes determined by on-chain execution
                    are final
                  </li>
                </ul>
                <p>
                  AI agents used in games (e.g., Blitz) must operate within
                  the parameters defined by each game's protocol. Use of
                  agents that circumvent game rules may result in
                  disqualification.
                </p>
              </Section>

              <Section title="7. DAO Governance">
                <p>
                  BibliothecaDAO governs aspects of the Realms ecosystem
                  through on-chain and off-chain voting. Participation in
                  governance is voluntary. Governance decisions are executed
                  according to the DAO's established processes and smart
                  contract logic.
                </p>
              </Section>

              <Section title="8. Intellectual Property">
                <p>
                  The Realms World website design, branding, and original
                  content are the property of BibliothecaDAO and its
                  contributors. Game source code is open-source and available
                  under the respective licenses published in each game's
                  repository.
                </p>
                <p>
                  Loot, Realms, and related NFT assets are community-owned.
                  Ownership of NFTs grants you rights as defined by their
                  respective smart contracts and community norms.
                </p>
              </Section>

              <Section title="9. Prohibited Conduct">
                <p>You agree not to:</p>
                <ul>
                  <li>
                    Use the Services for money laundering, terrorist
                    financing, or other illegal activities
                  </li>
                  <li>
                    Attempt to interfere with, disrupt, or attack the
                    Services or underlying smart contracts
                  </li>
                  <li>
                    Impersonate other users, DAO members, or project
                    contributors
                  </li>
                  <li>
                    Scrape, harvest, or collect user data without
                    authorization
                  </li>
                  <li>
                    Use automated systems to manipulate game outcomes or
                    governance votes outside of permitted agent frameworks
                  </li>
                </ul>
              </Section>

              <Section title="10. Disclaimers">
                <p>
                  THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE"
                  WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED.
                  WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED,
                  ERROR-FREE, OR SECURE.
                </p>
                <p>
                  WE ARE NOT RESPONSIBLE FOR ANY LOSSES ARISING FROM
                  BLOCKCHAIN NETWORK FAILURES, SMART CONTRACT BUGS, WALLET
                  COMPROMISES, TOKEN PRICE FLUCTUATIONS, OR YOUR FAILURE TO
                  SECURE YOUR PRIVATE KEYS.
                </p>
              </Section>

              <Section title="11. Limitation of Liability">
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, BIBLIOTHECADAO AND
                  ITS CONTRIBUTORS SHALL NOT BE LIABLE FOR ANY INDIRECT,
                  INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES
                  ARISING FROM YOUR USE OF THE SERVICES, INCLUDING BUT NOT
                  LIMITED TO LOSS OF FUNDS, DATA, OR PROFITS.
                </p>
              </Section>

              <Section title="12. Indemnification">
                <p>
                  You agree to indemnify and hold harmless BibliothecaDAO and
                  its contributors from any claims, damages, losses, or
                  expenses arising from your use of the Services or violation
                  of these Terms.
                </p>
              </Section>

              <Section title="13. Modifications">
                <p>
                  We reserve the right to modify these Terms at any time.
                  Material changes will be communicated by updating the "Last
                  updated" date. Continued use of the Services after changes
                  constitutes acceptance of the revised Terms.
                </p>
              </Section>

              <Section title="14. Severability">
                <p>
                  If any provision of these Terms is found to be
                  unenforceable, the remaining provisions shall continue in
                  full force and effect.
                </p>
              </Section>

              <Section title="15. Contact">
                <p>
                  For questions about these Terms, reach us through:
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
