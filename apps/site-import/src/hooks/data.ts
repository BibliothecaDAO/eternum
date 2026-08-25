export const tokenAddress = "GMzuntWYJLpNuCizrSR7ZXggiMdDzTNiEmSNHHunpump";

export const FAQS = [
  {
    question: "Team",
    answer:
      "The lead developer of Daydreams is @LordOfAFew (also known as Loaf). Daydreams is designed to solve the hardest problems every agent faces; long time horizon tasks. It allows agents to define all their tasks generatively, without hardcoding. By focusing on simple inputs and outputs, Daydreams enables the creation of agents capable of tackling extremely challenging problems. It serves as both a lightning rod and a breeding ground for next-generation agent systems. Find me on X @LordOfAFew and slide into my DMs.",
  },
  {
    question: "Token",
    answer: `Launched via pump.fun - contract address on Solana: ${tokenAddress}. $DREAMS token represents an opensource library for building generative agents.`,
  },
  {
    question: "Roadmap",
    answer:
      "Please see the Daydreams GitHub for Daydreams milestones. This is an opensource project and encourages community contributions. Daydreams is focused on DeFi and Gaming, but is not limited to these areas.",
  },
  {
    question: "Contribute",
    answer:
      "MIT Licensed. 45,000,000 of tokens are reserved for builder incentives. Contribute to Daydreams by submitting a PR to the GitHub repository.",
  },
  {
    question: "Partner Projects",
    answer:
      "Reach out to us at twitter @daydreamsagents - or make a PR to the GitHub repository.",
  },
];

interface Capability {
  title: string;
  description: string;
  icon: string; // SVG path data
}

export const CAPABILITIES: Capability[] = [
  {
    title: "Autonomous Trading",
    description:
      "Execute complex trading strategies across multiple chains with autonomous decision-making and risk management.",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    title: "Cross-Chain Operations",
    description:
      "Seamlessly operate across multiple blockchains with built-in bridge support and chain-agnostic execution.",
    icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2",
  },
  {
    title: "Game Automation",
    description:
      "Create sophisticated gaming agents that can learn, adapt, and execute complex strategies in onchain games.",
    icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Smart Contract Integration",
    description:
      "Interact with any smart contract through generative code execution and dynamic ABI handling.",
    icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z",
  },
  {
    title: "Data Processing",
    description:
      "Process and analyze onchain data in real-time with advanced filtering and pattern recognition.",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
  },
  {
    title: "Custom Strategies",
    description:
      "Build and deploy custom agent strategies with our flexible framework and extensive tooling.",
    icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
  },
];

interface Partner {
  name: string;
  url: string;
  logo: string;
  width: string;
  description?: string;
  type?: string;
}

export const PARTNERS: Partner[] = [
  {
    name: "Cartridge",
    url: "https://cartridge.gg/",
    logo: "/Cartridge.svg",
    width: "w-48",
    description: "Web3 Game Development Platform",
    type: "Gaming",
  },
  {
    name: "Starkware",
    url: "https://starkware.co/",
    logo: "/Starkware.svg",
    width: "w-48",
    description: "ZK Rollup Technology",
    type: "Infrastructure",
  },
  {
    name: "Starknet",
    url: "https://www.starknet.io/",
    logo: "/Starknet.svg",
    width: "w-48",
    description: "Layer 2 Scaling Solution",
    type: "L2",
  },
  {
    name: "Dojo",
    url: "https://www.dojoengine.org/",
    logo: "/dojo-logo.svg",
    width: "w-32",
    description: "Onchain Game Engine",
    type: "Gaming",
  },
  {
    name: "Realms",
    url: "https://realms.world/",
    logo: "/RealmsWorld.svg",
    width: "w-16  ",
    description: "Web3 Gaming Metaverse",
    type: "Gaming",
  },
  {
    name: "Alkane",
    url: "https://alkanes.build/",
    logo: "/alkane-logo.png",
    width: "w-16",
    description: "BTC Wallet",
    type: "Wallet",
  },
  {
    name: "89",
    url: "https://token.project89.org/",
    logo: "/89-logo.png",
    width: "w-16",
    description: "Project 89 Swarms",
    type: "AI",
  },
];

interface Blockchain {
  name: string;
  logo: string;
  url: string;
  width: string;
}

export const BLOCKCHAINS: Blockchain[] = [
  {
    name: "Ethereum",
    logo: "/eth-logo.svg",
    url: "https://ethereum.org",
    width: "w-8",
  },
  {
    name: "Solana",
    logo: "/solana-logo.svg",
    url: "https://solana.com",
    width: "w-8",
  },
  {
    name: "Base",
    logo: "/base-logo.svg",
    url: "https://base.org",
    width: "w-8",
  },
  {
    name: "Arbitrum",
    logo: "/arbitrum-logo.svg",
    url: "https://arbitrum.io",
    width: "w-8",
  },
  {
    name: "HyperLiquid",
    logo: "/hl-logo.svg",
    url: "https://app.hyperliquid.xyz/",
    width: "w-8",
  },
  {
    name: "Optimism",
    logo: "/optimism-logo.svg",
    url: "https://optimism.io",
    width: "w-8",
  },
  {
    name: "Starknet",
    logo: "/starknet-logo.svg",
    url: "https://starknet.io",
    width: "w-8",
  },
  {
    name: "Abstract",
    logo: "/abstract-logo.svg",
    url: "https://abs.xyz/",
    width: "w-8",
  },
  {
    name: "Mud",
    logo: "/mud-logo.svg",
    url: "https://mud.dev/",
    width: "w-8",
  },
  {
    name: "Dojo",
    logo: "/dojo-icon.svg",
    url: "https://www.dojoengine.org/",
    width: "w-8",
  },
];

interface NavItem {
  name: string;
  url: string;
  icon: string; // SVG path data
  showTextOnMobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    name: "DOCS",
    url: "https://docs.dreams.fun",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  {
    name: "GITHUB",
    url: "https://github.com/daydreamsai/daydreams",
    icon: "github", // Special case for Lucide icon
  },
  {
    name: "DISCORD",
    url: "https://discord.gg/P8UUNGtHZs",
    icon: "M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z",
  },
];

interface RoadmapItem {
  phase: string;
  title: string;
  description: string;
  status: "completed" | "in-progress" | "upcoming";
  items: string[];
  image: string;
}

export const ROADMAP: RoadmapItem[] = [
  {
    phase: "Phase 1",
    title: "Foundation",
    description: "Core framework and infrastructure development",
    status: "completed",
    image: "/stage-1.png",
    items: [
      "Core agent framework development",
      "Cross-chain execution providers",
      "Generative agent code execution",
      "Advanced Chain of Thought",
      "Initial documentation",
    ],
  },
  {
    phase: "Phase 2",
    title: "Integration & Expansion",
    description: "Expanding ecosystem integrations and capabilities",
    status: "in-progress",
    image: "/stage-2.png",
    items: [
      "Example Agents",
      "Advanced Agents completing complex tasks",
      "Onchain gaming agents",
      "Multi-agent reinforcement learning via swarm learning",
      "Community contribution framework",
      "No-code agent creation",
      "Ecosystem growth grants",
    ],
  },
  {
    phase: "Phase 3",
    title: "Advanced Features & Daydreams VM",
    description: "Enhanced capabilities and optimization",
    status: "upcoming",
    image: "/stage-3.png",
    items: [
      "Daydreams VM for dynamic code execution in the browser",
      "No-code agent creation",
      "On the fly LLM fine-tuning",
      "Automated strategy generation",
      "Performance optimization suite",
    ],
  },
];

interface Integration {
  name: string;
  logo: string;
  url: string;
}

interface ExampleAgent {
  title: string;
  description: string;
  image: string;
  tags: string[];
  integratedWith: Integration[];
  status: "live" | "demo" | "coming-soon";
}

export const EXAMPLE_AGENTS: ExampleAgent[] = [
  {
    title: "Cross-Chain Arbitrage Agent",
    description:
      "Monitors and executes arbitrage opportunities across multiple DEXs and chains automatically.",
    image: "/agent-1.png",
    tags: ["DeFi", "Arbitrage", "Multi-chain", "MEV"],
    integratedWith: [
      {
        name: "HyperLiquid",
        logo: "/hl-logo.svg",
        url: "https://hyperliquid.xyz",
      },
      { name: "Base", logo: "/base-logo.svg", url: "https://base.org" },
      {
        name: "Optimism",
        logo: "/optimism-logo.svg",
        url: "https://optimism.io",
      },
      {
        name: "Arbitrum",
        logo: "/arbitrum-logo.svg",
        url: "https://arbitrum.io",
      },
    ],
    status: "coming-soon",
  },
  {
    title: "Game NPC",
    description:
      "Autonomous agent that uses hierarchical task networks to break down complex game strategies into simpler subtasks for more effective gameplay.",
    image: "/agent.png",
    tags: ["Gaming", "Strategy", "AI", "Auto-Battler"],
    integratedWith: [
      {
        name: "Dojo",
        logo: "/dojo-icon.svg",
        url: "https://www.dojoengine.org",
      },
      {
        name: "Starknet",
        logo: "/starknet-logo.svg",
        url: "https://starknet.io",
      },
    ],
    status: "coming-soon",
  },
  {
    title: "Liquidity Management Agent",
    description:
      "Optimizes liquidity positions across multiple pools based on market conditions and yield opportunities.",
    image: "/agent-2.png",
    tags: ["DeFi", "Liquidity", "Yield", "AMM"],
    integratedWith: [
      {
        name: "Base",
        logo: "/base-logo.svg",
        url: "https://base.org",
      },
    ],
    status: "coming-soon",
  },
  {
    title: "Community Assistant Agent",
    description:
      "AI-powered assistant that monitors Discord and Telegram channels, answering questions and providing real-time support.",
    image: "/agent-3.png",
    tags: ["Community", "Support", "AI", "Communication"],
    integratedWith: [
      {
        name: "Discord",
        logo: "/discord-logo.svg",
        url: "https://discord.com",
      },
      {
        name: "Telegram",
        logo: "/telegram-logo.svg",
        url: "https://telegram.org",
      },
    ],
    status: "coming-soon",
  },
];

interface Exchange {
  name: string;
  logo: string;
  url: string;
}

export const AVAILABLE_ON: Exchange[] = [
  {
    name: "Raydium",
    logo: "/raydium-logo.svg",
    url: "https://raydium.io/swap/?inputCurrency=sol&outputCurrency=GMzuntWYJLpNuCizrSR7ZXggiMdDzTNiEmSNHHunpump",
  },
  {
    name: "Jupiter",
    logo: "/jupiter-logo.svg",
    url: "https://jup.ag/swap/SOL-DREAMS_GMzuntWYJLpNuCizrSR7ZXggiMdDzTNiEmSNHHunpump",
  },
  {
    name: "Pump.fun",
    logo: "/pump.png",
    url: "https://pump.fun/coin/GMzuntWYJLpNuCizrSR7ZXggiMdDzTNiEmSNHHunpump",
  },
  {
    name: "MEXC",
    logo: "/mexc-logo.svg",
    url: "https://www.mexc.com/exchange/DREAMSOL_USDT",
  },
  {
    name: "Lbank",
    logo: "/lbank-logo.svg",
    url: "https://www.lbank.info/exchange/dreams/usdt",
  },
];
