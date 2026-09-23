import type { ReactNode } from "react";

import { Panel, PanelTitle } from "./kit";

/** The terms and the privacy policy: static text, so the shell serves it with no game module. */

interface LegalSection {
  title: string;
  body: ReactNode;
}

const ExternalLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-gold underline hover:brightness-110">
    {children}
  </a>
);

const CONTACT = (
  <>
    <ul>
      <li>
        Discord: <ExternalLink href="https://discord.gg/realmsworld">discord.gg/realmsworld</ExternalLink>
      </li>
      <li>
        GitHub: <ExternalLink href="https://github.com/BibliothecaDAO">github.com/BibliothecaDAO</ExternalLink>
      </li>
    </ul>
  </>
);

const LegalPage = ({ title, updated, sections }: { title: string; updated: string; sections: LegalSection[] }) => (
  <article className="mx-auto max-w-[880px] space-y-4">
    <div>
      <PanelTitle>Legal</PanelTitle>
      <h1 className="font-cinzel text-2xl font-semibold text-gold sm:text-4xl">{title}</h1>
      <p className="mt-2 text-[12px] text-gold/60">Last updated: {updated}</p>
    </div>
    <Panel className="space-y-6">
      {sections.map((section, index) => (
        <section key={section.title}>
          <h2 className="mb-2 font-cinzel text-[15px] font-semibold text-gold">
            {index + 1}. {section.title}
          </h2>
          <div className="space-y-3 text-[13px] leading-relaxed text-gold/75 [&_li]:mb-1 [&_strong]:text-gold/90 [&_ul]:list-disc [&_ul]:pl-5">
            {section.body}
          </div>
        </section>
      ))}
    </Panel>
  </article>
);

const TERMS: LegalSection[] = [
  {
    title: "Acceptance of Terms",
    body: (
      <>
        <p>
          By accessing or using Realms World (realms.world) and its associated services, games, and smart contracts
          (collectively, the "Services"), you agree to be bound by these Terms of Service ("Terms"). The Services are
          operated by BibliothecaDAO and its contributors.
        </p>
        <p>If you do not agree to these Terms, do not use the Services.</p>
      </>
    ),
  },
  {
    title: "Eligibility",
    body: (
      <ul>
        <li>You must be at least 18 years of age to use the Services.</li>
        <li>
          You must not be located in, or a resident of, any jurisdiction where access to blockchain-based services or
          digital assets is prohibited.
        </li>
        <li>You are responsible for ensuring compliance with all applicable laws in your jurisdiction.</li>
      </ul>
    ),
  },
  {
    title: "Description of Services",
    body: (
      <>
        <p>
          Realms World provides a web interface to interact with on-chain games, governance tools, and ecosystem
          resources built on the Starknet and Ethereum blockchains. The Services include but are not limited to:
        </p>
        <ul>
          <li>Access to on-chain games (Eternum, Blitz, Loot Survivor, and others)</li>
          <li>$LORDS token staking (veLORDS)</li>
          <li>DAO governance participation via Frontinus House</li>
          <li>Game leaderboards, statistics, and ecosystem data</li>
          <li>Blog content and ecosystem updates (Scroll)</li>
        </ul>
      </>
    ),
  },
  {
    title: "Blockchain Interactions",
    body: (
      <>
        <p>
          <strong>Irreversibility.</strong> Transactions submitted to blockchain networks are irreversible. Once
          confirmed, they cannot be cancelled, reversed, or refunded. You are solely responsible for reviewing
          transaction details before confirming.
        </p>
        <p>
          <strong>Gas Fees.</strong> Blockchain transactions require gas fees paid in the native token of the network
          (e.g., ETH on Ethereum, STRK on Starknet). These fees are paid to network validators, not to us.
        </p>
        <p>
          <strong>Smart Contract Risk.</strong> The Services interact with smart contracts deployed on public
          blockchains. While these contracts are open-source and auditable, they may contain bugs or vulnerabilities.
          You interact with smart contracts at your own risk.
        </p>
        <p>
          <strong>Wallet Security.</strong> You are responsible for maintaining the security of your wallet and private
          keys. We never have access to your private keys and cannot recover lost funds.
        </p>
      </>
    ),
  },
  {
    title: "$LORDS Token and Digital Assets",
    body: (
      <>
        <p>
          $LORDS is a utility token used within the Realms ecosystem for game entry, marketplace transactions,
          governance, and staking. By using $LORDS or any digital assets through our Services:
        </p>
        <ul>
          <li>You acknowledge that digital assets are volatile and may lose value.</li>
          <li>
            You understand that we do not guarantee the value, liquidity, or transferability of any digital asset.
          </li>
          <li>
            You accept that game rewards, staking yields, and other incentives are subject to change based on protocol
            mechanics and DAO governance.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Game Rules and Fair Play",
    body: (
      <>
        <p>When participating in on-chain games you agree to:</p>
        <ul>
          <li>Abide by the rules and mechanics of each game as defined by its smart contracts</li>
          <li>Not exploit bugs, vulnerabilities, or unintended behaviors for unfair advantage</li>
          <li>Report any discovered vulnerabilities through responsible disclosure to the development team</li>
          <li>Accept that game outcomes determined by on-chain execution are final</li>
        </ul>
        <p>
          AI agents used in games (e.g., Blitz) must operate within the parameters defined by each game's protocol. Use
          of agents that circumvent game rules may result in disqualification.
        </p>
      </>
    ),
  },
  {
    title: "DAO Governance",
    body: (
      <p>
        BibliothecaDAO governs aspects of the Realms ecosystem through on-chain and off-chain voting. Participation in
        governance is voluntary. Governance decisions are executed according to the DAO's established processes and
        smart contract logic.
      </p>
    ),
  },
  {
    title: "Intellectual Property",
    body: (
      <>
        <p>
          The Realms World website design, branding, and original content are the property of BibliothecaDAO and its
          contributors. Game source code is open-source and available under the respective licenses published in each
          game's repository.
        </p>
        <p>
          Loot, Realms, and related NFT assets are community-owned. Ownership of NFTs grants you rights as defined by
          their respective smart contracts and community norms.
        </p>
      </>
    ),
  },
  {
    title: "Prohibited Conduct",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Services for money laundering, terrorist financing, or other illegal activities</li>
          <li>Attempt to interfere with, disrupt, or attack the Services or underlying smart contracts</li>
          <li>Impersonate other users, DAO members, or project contributors</li>
          <li>Scrape, harvest, or collect user data without authorization</li>
          <li>
            Use automated systems to manipulate game outcomes or governance votes outside of permitted agent frameworks
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Disclaimers",
    body: (
      <>
        <p>
          THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR
          IMPLIED. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
        </p>
        <p>
          WE ARE NOT RESPONSIBLE FOR ANY LOSSES ARISING FROM BLOCKCHAIN NETWORK FAILURES, SMART CONTRACT BUGS, WALLET
          COMPROMISES, TOKEN PRICE FLUCTUATIONS, OR YOUR FAILURE TO SECURE YOUR PRIVATE KEYS.
        </p>
      </>
    ),
  },
  {
    title: "Limitation of Liability",
    body: (
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, BIBLIOTHECADAO AND ITS CONTRIBUTORS SHALL NOT BE LIABLE FOR ANY
        INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICES,
        INCLUDING BUT NOT LIMITED TO LOSS OF FUNDS, DATA, OR PROFITS.
      </p>
    ),
  },
  {
    title: "Indemnification",
    body: (
      <p>
        You agree to indemnify and hold harmless BibliothecaDAO and its contributors from any claims, damages, losses,
        or expenses arising from your use of the Services or violation of these Terms.
      </p>
    ),
  },
  {
    title: "Modifications",
    body: (
      <p>
        We reserve the right to modify these Terms at any time. Material changes will be communicated by updating the
        "Last updated" date. Continued use of the Services after changes constitutes acceptance of the revised Terms.
      </p>
    ),
  },
  {
    title: "Severability",
    body: (
      <p>
        If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full
        force and effect.
      </p>
    ),
  },
  {
    title: "Contact",
    body: (
      <>
        <p>For questions about these Terms, reach us through:</p>
        {CONTACT}
      </>
    ),
  },
];

const PRIVACY: LegalSection[] = [
  {
    title: "Introduction",
    body: (
      <>
        <p>
          Realms World ("we," "us," or "our") is operated by BibliothecaDAO. This Privacy Policy explains how we
          collect, use, and protect information when you use our website at realms.world and related services
          (collectively, the "Services").
        </p>
        <p>
          Our Services interact with public blockchain networks (primarily Starknet and Ethereum). On-chain transactions
          are public by design and are not covered by this policy.
        </p>
      </>
    ),
  },
  {
    title: "Information We Collect",
    body: (
      <>
        <p>
          <strong>Information you provide</strong>
        </p>
        <ul>
          <li>Wallet addresses when you connect to our Services</li>
          <li>Communications you send us (e.g., support requests via Discord)</li>
          <li>Feedback, proposals, or governance votes submitted through the DAO</li>
        </ul>
        <p>
          <strong>Information collected automatically</strong>
        </p>
        <ul>
          <li>Device and browser information (type, operating system, screen resolution)</li>
          <li>IP address and approximate geographic location</li>
          <li>Usage data (pages visited, time spent, referral source)</li>
          <li>Performance and error data to improve reliability</li>
        </ul>
        <p>
          <strong>Blockchain data</strong>
        </p>
        <p>
          When you interact with on-chain games or contracts, your wallet address and transaction history are recorded
          on the public blockchain. This data is inherently public and immutable. We may index and display this data
          within our Services.
        </p>
      </>
    ),
  },
  {
    title: "How We Use Your Information",
    body: (
      <ul>
        <li>Provide, maintain, and improve our Services</li>
        <li>Display game data, leaderboards, and treasury information</li>
        <li>Process governance proposals and DAO operations</li>
        <li>Detect and prevent fraud or abuse</li>
        <li>Communicate service updates and announcements</li>
        <li>Comply with legal obligations</li>
      </ul>
    ),
  },
  {
    title: "Information Sharing",
    body: (
      <>
        <p>We do not sell your personal information. We may share data in the following circumstances:</p>
        <ul>
          <li>
            <strong>Service Providers:</strong> Third-party analytics and infrastructure providers that help us operate
            the Services
          </li>
          <li>
            <strong>On-chain:</strong> Transaction data submitted to blockchain networks is publicly visible
          </li>
          <li>
            <strong>Legal Requirements:</strong> When required by law, regulation, or legal process
          </li>
          <li>
            <strong>Safety:</strong> To protect the rights, property, or safety of our users or the public
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Third-Party Services",
    body: (
      <>
        <p>Our Services integrate with third-party platforms including:</p>
        <ul>
          <li>
            <strong>Cartridge</strong> — Session key wallet infrastructure for game interactions
          </li>
          <li>
            <strong>Starknet / Ethereum</strong> — Public blockchain networks for on-chain game execution
          </li>
          <li>
            <strong>Snapshot</strong> — Governance voting platform
          </li>
        </ul>
        <p>These services have their own privacy policies. We encourage you to review them.</p>
      </>
    ),
  },
  {
    title: "Data Retention",
    body: (
      <p>
        We retain collected information for as long as necessary to provide our Services and fulfill the purposes
        described in this policy. On-chain data is permanent and cannot be deleted due to the immutable nature of
        blockchain technology.
      </p>
    ),
  },
  {
    title: "Security",
    body: (
      <p>
        We implement reasonable technical and organizational measures to protect information under our control. However,
        no system is perfectly secure. We cannot guarantee the absolute security of your information.
      </p>
    ),
  },
  {
    title: "Your Rights",
    body: (
      <>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data (where technically feasible)</li>
          <li>Object to or restrict processing of your data</li>
          <li>Data portability</li>
        </ul>
        <p>
          Note that on-chain data cannot be modified or deleted due to blockchain immutability. To exercise your rights
          regarding off-chain data, contact us via Discord.
        </p>
      </>
    ),
  },
  {
    title: "Cookies and Tracking",
    body: (
      <>
        <p>We use minimal cookies and local storage necessary for the functioning of our Services, including:</p>
        <ul>
          <li>Session and wallet connection state</li>
          <li>Theme and display preferences</li>
          <li>Basic analytics to understand site usage</li>
        </ul>
        <p>We do not use third-party advertising cookies or cross-site tracking.</p>
      </>
    ),
  },
  {
    title: "Children",
    body: (
      <p>
        Our Services are not directed to individuals under 18. We do not knowingly collect personal information from
        children. If you believe a child has provided us with personal information, please contact us.
      </p>
    ),
  },
  {
    title: "Changes to This Policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. We will notify users of material changes by updating the
        "Last updated" date and posting the revised policy on this page.
      </p>
    ),
  },
  {
    title: "Contact",
    body: (
      <>
        <p>For privacy-related questions or requests, reach us through:</p>
        {CONTACT}
      </>
    ),
  },
];

export const TermsPage = () => <LegalPage title="Terms of Service" updated="February 2025" sections={TERMS} />;

export const PrivacyPage = () => <LegalPage title="Privacy Policy" updated="February 2025" sections={PRIVACY} />;
