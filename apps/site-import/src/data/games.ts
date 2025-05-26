export interface Game {
  id: number;
  slug: string;
  title: string;
  image: string;
  backgroundImage: string;
  backgroundImages?: string[];
  genre?: string[];
  description: string;
  status: "mainnet" | "testnet" | "development";
  isLive: boolean;
  studio: string;
  whitepaper?: string;
  players?: number;
  tvl?: number;
  video?: string;
  links?: {
    homepage?: string;
    discord?: string;
    twitter?: string;
    telegram?: string;
    github?: string;
  };
}

export const games: Game[] = [
  {
    id: 9,
    slug: "realms-eternum",
    title: "Realms: Eternum",
    image: "/games/realms-eternum/cover.png",
    backgroundImage: "/games/realms-eternum/cover.png",
    players: 600,
    backgroundImages: [
      "/games/realms-eternum/screenshots/1.png",
      "/games/realms-eternum/screenshots/2.png",
      "/games/realms-eternum/screenshots/3.png",
    ],
    genre: ["Economic Strategy", "PvP", "Raiding", "Economy"],
    description:
      "Eternum represents the culmination of two years of dedicated effort, aimed at crafting a world that transcends the bounds of its creators. It's not just a game; it's a sophisticated fusion of economic and social frameworks, forming the backbone of a burgeoning digital society. Eternum is designed to evolve and grow, offering a dynamic experience far removed from the conventional notion of a 'finished game' like Civilization 6. Think of it as a living, breathing digital ecosystem, constantly evolving and inviting endless exploration.",
    status: "mainnet",
    isLive: true,
    studio: "biblio-dao",
    whitepaper: "https://github.com/BibliothecaDAO/world-guide",
    video: "https://www.youtube.com/embed/EDt8vGBDcYg", // Example video URL - replace with actual

    links: {
      homepage: "https://eternum.realms.world/",
      discord: "https://discord.gg/realmsworld",
      twitter: "https://twitter.com/RealmsEternum",
      github: "https://github.com/BibliothecaDAO/eternum",
    },
  },
  {
    id: 3,
    slug: "dark-shuffle",
    title: "Dark Shuffle",
    image: "/games/dark-shuffle/cover.webp",
    backgroundImage: "/games/dark-shuffle/cover.webp",
    backgroundImages: [
      "/games/dark-shuffle/screenshots/1.png",
      "/games/dark-shuffle/screenshots/2.png",
      "/games/dark-shuffle/screenshots/3.png",
    ],
    genre: ["Deck-building", "Roguelike", "Play to Die"],
    description:
      "Draft a deck of mighty creatures and powerful spells. Venture through a map of challenges and fight against the beasts. Compete in seasons and reap the rewards.",
    status: "mainnet",
    isLive: true,
    studio: "Provable Games",
    links: {
      homepage: "https://darkshuffle.dev/",
      discord: "https://discord.gg/uQnjZhZPfu",
      twitter: "https://twitter.com/await_0x",
    },
  },
  {
    id: 5,
    slug: "loot-survivor",
    title: "Loot Survivor",
    image: "/games/loot-survivor/cover.webp",
    backgroundImage: "/games/loot-survivor/cover.webp",
    backgroundImages: [
      "/games/loot-survivor/screenshots/1.png",
      "/games/loot-survivor/screenshots/2.png",
      "/games/loot-survivor/screenshots/3.png",
      "/games/loot-survivor/screenshots/4.png",
    ],
    genre: ["Play to Die", "Roguelike"],
    description:
      "Survivors is the first Loot adventure game exploring the Play2Die mechanic. It is a game of onchain survival where you must defeat beasts and collect gear in the fight to stay alive and make it to the top of the leaderboard.",
    status: "mainnet",
    isLive: true,
    studio: "Provable Games",
    players: 1250,
    links: {
      homepage: "https://survivor.realms.world/",
      discord: "https://discord.gg/realmsworld",
      twitter: "https://twitter.com/LootRealms",
    },
  },

  {
    id: 8,
    slug: "pistols-at-dawn",
    title: "Pistols at Dawn",
    image: "/games/pistols/cover.webp",
    backgroundImage: "/games/pistols/cover.webp",
    backgroundImages: [
      "/games/pistols/screenshots/1.png",
      "/games/pistols/screenshots/2.png",
      "/games/pistols/screenshots/3.png",
      "/games/pistols/screenshots/4.png",
      "/games/pistols/screenshots/5.png",
      "/games/pistols/screenshots/6.png",
    ],
    genre: ["Social", "Casual", "Strategy", "PVP"],
    description:
      'Thou art an offence to all that is decent, dog. I challenge you... to a duel!". In Pistols at Dawn, you face off against your opponent for honour or profit, in a pistol duel at "10" paces. Will you duel with honour, or turn early and shoot the wretched cur in the back? Earn yourself fame and riches, or a shallow grave in the crypt beneath the Fool & Flintlock tavern',
    status: "mainnet",
    isLive: true,
    studio: "Underware",
    links: {
      homepage: "https://pistols.underware.gg/",
      discord: "https://discord.gg/realmsworld",
      twitter: "https://x.com/underware_gg",
    },
  },
  /*{
    id: 11,
    title: "Underdark",
    image: "/games/underdark/cover.webp",
    backgroundImage: "/games/underdark/cover.webp",
    backgroundImages: [
      "/games/underdark/screenshots/0.png",
      "/games/underdark/screenshots/1.png",
      "/games/underdark/screenshots/2.png",
      "/games/underdark/screenshots/3.png",
      "/games/underdark/screenshots/4.png",
      "/games/underdark/screenshots/5.png"
    ],
    genre: ["Play to Die", "Roguelike", "Horror", "PVE"],
    description: "Underdark: Lair of the Slenderduck is a unique location in The Underworld & Realms.World, and a generative onchain dungeon skin-crawler built on Dojo & Starknet. You have hubristically stumbled into the twisting tunnels beneath the manor at Old Kurnkornor, where you will lose your mind. With each step your limited light fades, and you descend further into madness. Collect Dark Tar to renew your light, avoid the twisted duck spawn, and find the stairs to escape the Slenderduck's gibbering embrace, even if only for a few more precious moments of sanity.",
    status: "development",
    isLive: true,
    studio: "underware",
    links: {
      homepage: "https://lootunder.world/underdark",
      twitter: "https://x.com/LootUnderworld"
    }
  },
  {
    id: 12,
    title: "zKrown",
    image: "/games/zkrown/cover.webp",
    backgroundImage: "/games/zkrown/cover.webp",
    backgroundImages: [
      "/games/zkrown/screenshots/0.webp",
      "/games/zkrown/screenshots/1.webp",
      "/games/zkrown/screenshots/2.webp",
      "/games/zkrown/screenshots/3.webp"
    ],
    genre: ["Strategy", "PvP", "Casual"],
    description: "zKrown is a strategy game based on Risk, focusing on conquest and realm defense. Players compete to dominate the map and win rewards. You can compete up to 6 players",
    status: "development",
    isLive: true,
    studio: "zkorp",
    links: {
      homepage: "https://app.zconqueror.xyz/",
      twitter: "https://twitter.com/zKorp_"
    }
  },*/
  {
    id: 13,
    slug: "zkube",
    title: "zKube",
    image: "/games/zkube/cover.png",
    backgroundImage: "/games/zkube/cover.png",
    backgroundImages: [
      "/games/zkube/screenshots/1.png",
      "/games/zkube/screenshots/2.png",
      "/games/zkube/screenshots/0.png",
    ],
    genre: ["Strategy", "Mobile", "Casual"],
    description:
      "zKube is a casual puzzle game you can play on your mobile seamlessly. Join the daily or monthly tournament to conquer the leaderboard and earn rewards!",
    status: "mainnet",
    isLive: true,
    studio: "zkorp",
    links: {
      homepage: "https://app.zkube.xyz/",
      twitter: "https://twitter.com/zKube_game",
    },
  },
  {
    id: 1,
    slug: "blob-arena",
    title: "Blob Arena",
    image: "/games/blob-arena/cover.webp",
    backgroundImage: "/games/blob-arena/cover.webp",
    backgroundImages: [
      "/games/blob-arena/screenshots/1.png",
      "/games/blob-arena/screenshots/2.png",
      "/games/blob-arena/screenshots/3.png",
    ],
    genre: ["Turn-Based Combat", "Strategy"],
    description:
      "Aiming to deliver a high-quality gaming experience, Blob Arena stands out for its gameplay dynamics and strategic focus. Players will navigate through exciting encounters, against other players or against AI, using their Bloberts' distinctive traits to outsmart and defeat opponents. The game's core mechanic revolves around an enhanced rock-paper-scissors style combat modified by each character's attributes such as Attack, Defence, Speed, and Strength, which are crucial for mastering the game.",
    status: "mainnet",
    isLive: true,
    studio: "Grugs Lair",
    links: {
      homepage: "https://www.blobarena.xyz/",
      discord: "https://discord.gg/Aa43XBgYvh",
      twitter: "https://x.com/Blobarena",
      github: "https://github.com/grugslair/Blob-arena",
    },
  },
  {
    id: 10,
    slug: "rising-revenant",
    title: "Rising Revenant",
    image: "/games/rising-revenant/cover.webp",
    backgroundImage: "/games/rising-revenant/cover.webp",
    backgroundImages: [
      "/games/rising-revenant/screenshots/1.png",
      "/games/rising-revenant/screenshots/2.png",
      "/games/rising-revenant/screenshots/3.png",
      "/games/rising-revenant/screenshots/4.png",
    ],
    genre: ["Last Man Standing", "Strategy"],
    description:
      "Rising Revenant is an immersive last man standing strategy game built on Starknet and powered by Dojo. The game unfolds in two distinct stages. In the preparation phase, players meticulously plan their strategies, allocate resources, and invest in critical upgrades. Once preparations are complete, the game transitions into the action-packed game phase, where players unleash their reinforcements, trade and engage in intense events. Success in Rising Revenant hinges on strategic planning and tactical prowess, with performance in both phases determining the rewards. The ultimate objective: to be the last Revenant standing.",
    status: "development",
    isLive: false,
    studio: "Grugs Lair",
    links: {
      twitter: "https://twitter.com/RRisingRevenant",
      github: "https://github.com/GrugLikesRocks/Rising-Revenant",
    },
  },
  // {
  //   id: 2,
  //   title: "Call the Banners",
  //   image: "/games/call-the-banners/cover.webp",
  //   backgroundImage: "/games/call-the-banners/cover.webp",
  //   backgroundImages: ["/games/call-the-banners/screenshots/1.png"],
  //   genre: ["Social", "Strategy", "PvP"],
  //   description:
  //     "Call the Banners is a game where mercenaries navigate blurred lines between loyalty and betrayal in a medieval siege. Choose a side, manage resources, and strategize to destroy the opposing castle, with victory bringing rewards. Which side will you lend your sword?",
  //   status: "development",
  //   isLive: false,
  //   studio: "Banners for Adventurers",
  //   links: {
  //     homepage: "https://www.bannersnft.com/",
  //     discord: "https://discord.gg/8WybFeKn",
  //     twitter: "https://twitter.com/callthe_banners",
  //   },
  // },
  // {
  //   id: 6,
  //   title: "Loot Underworld",
  //   image: "/games/loot-underworld/cover.webp",
  //   backgroundImage: "/games/loot-underworld/cover.webp",
  //   backgroundImages: [
  //     "/games/loot-underworld/screenshots/1.png",
  //     "/games/loot-underworld/screenshots/2.png",
  //     "/games/loot-underworld/screenshots/3.png",
  //     "/games/loot-underworld/screenshots/4.png",
  //     "/games/loot-underworld/screenshots/5.png",
  //     "/games/loot-underworld/screenshots/6.png",
  //   ],
  //   genre: ["Play to Die", "Roguelike", "RPG", "Dungeon Crawler"],
  //   description:
  //     "Explore the endless mysteries of The Underworld. A living autonomous (under)world of drama, story and danger, waiting to be explored and shaped by its inhabitants, and occupying the liminal space between and underneath. Underworld is an extension to Eternum & Realms, built on Starknet and Dojo, adding composable building blocks, and enabling a range of interoperable game experiences. The flagship game will be a retro narrative dungeon crawler.",
  //   status: "development",
  //   isLive: false,
  //   studio: "Underware",
  //   links: {
  //     homepage: "https://lootunder.world",
  //     twitter: "https://x.com/LootUnderworld",
  //   },
  // },
  // {
  //   id: 7,
  //   title: "Paved",
  //   image: "/games/paved/cover.webp",
  //   backgroundImage: "/games/paved/cover.webp",
  //   backgroundImages: [
  //     "/games/paved/screenshots/1.png",
  //     "/games/paved/screenshots/2.png",
  //   ],
  //   genre: ["Tile-matching", "Puzzle", "Strategy"],
  //   description:
  //     "In PAVED, players compete for high scores and rewards by laying tiles to form an expanding medieval landscape. Inspired by the board game Carcassonne, solo and multiplayer modes offer unique, strategic experiences that test both planning and decisiveness. Think you've got what it takes? Pave your way to victory in a fully onchain strategy game like no other.",
  //   status: "development",
  //   isLive: false,
  //   studio: "Paved Studios",
  //   links: {
  //     homepage: "https://sepolia.paved.gg/",
  //     discord: "https://discord.gg/uQnjZhZPfu",
  //     twitter: "https://twitter.com/pavedgame",
  //   },
  // },
];
