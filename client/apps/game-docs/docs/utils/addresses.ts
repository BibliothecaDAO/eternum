import { env } from "@/../env";

// Type definitions
export type Chain = "sepolia" | "mainnet" | "slot" | "local";

interface SeasonAddresses {
  villagePass: string;
  seasonPass: string;
  realms: string;
  lords: string;
  resources: {
    [key: string]: (string | number)[];
  };
  marketplace: string;
}

// Fallback data for mainnet (prevents build failures)
const fallbackMainnetAddresses: SeasonAddresses = {
  seasonPass: "0x60e8836acbebb535dfcd237ff01f20be503aae407b67bb6e3b5869afae97156",
  realms: "0x7ae27a31bb6526e3de9cf02f081f6ce0615ac12a6d7b85ee58b8ad7947a2809",
  lords: "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
  villagePass: "0x7ad410c472c1d61ce318dd617a479c977c85275afbf7991a1e1461ffe626a3d",
  marketplace: "0x0489d2220e8b61f43a02786e76e93bc63e07c564fdca823254e8a20072a840a7",
  resources: {
    "STONE": [1, "0x439a1c010e3e1bb2d43d43411000893c0042bd88f6c701611a0ea914d426da4"],
    "COAL": [2, "0xce635e3f241b0ae78c46a929d84a9101910188f9c4024eaa7559556503c31a"],
    "WOOD": [3, "0x40d8907cec0f7ae9c364dfb12485a1314d84c129bf1898d2f3d4b7fcc7d44f4"],
    "COPPER": [4, "0x66ed5c928ee027a9419ace1cbea8389885161db5572a7c5c4fef2310e9bf494"],
    "IRONWOOD": [5, "0x1720cf6318bff45e62acc588680ae3cd4d5f8465b1d52cb710533c9299b031a"],
    "OBSIDIAN": [6, "0x3b6448d09dcd023507376402686261f5d6739455fa02f804907b066e488da66"],
    "GOLD": [7, "0xdff9dca192609c4e86ab3be22c7ec1e968876c992d21986f3c542be97fa2f"],
    "SILVER": [8, "0x6fe21d2d4a8a05bdb70f09c9250af9870020d5dcc35f410b4a39d6605c3e353"],
    "MITHRAL": [9, "0x67ba235c569c23877064b2ac6ebd4d79f32d3c00f5fab8e28a3b5700b957f6"],
    "ALCHEMICALSILVER": [10, "0x3956a5301e99522038a2e7dcb9c2a89bf087ffa79310ee0a508b5538efd8ddd"],
    "COLDIRON": [11, "0x555d713e59d4ff96b7960447e9bc9e79bfdeab5b0eea74e3df81bce61cfbc77"],
    "DEEPCRYSTAL": [12, "0x1d655ac834d38df7921074fc1588411e202b1af83307cbd996983aff52db3a8"],
    "RUBY": [13, "0x3d9b66720959d0e7687b898292c10e62e78626f2dba5e1909961a2ce3f86612"],
    "DIAMONDS": [14, "0xe03ea8ae385f64754820af5c01c36abf1b8130dd6797d3fd9d430e4114e876"],
    "HARTWOOD": [15, "0x5620aa7170cd66dbcbc37d03087bfe4633ffef91d3e4d97b501de906004f79b"],
    "IGNIUM": [16, "0x625c1f789b03ebebc7a9322366f38ebad1f693b84b2abd8cb8f5b2748b0cdd5"],
    "TWILIGHTQUARTZ": [17, "0x35e24c02409c3cfe8d5646399a62c4d102bb782938d5f5180e92c9c62d3faf7"],
    "TRUEICE": [18, "0x4485f5a6e16562e1c761cd348e63256d00389e3ddf4f5d98afe7ab44c57c481"],
    "ADAMANTINE": [19, "0x367f838f85a2f5e1580d6f011e4476f581083314cff8721ba3dda9706076eed"],
    "SAPPHIRE": [20, "0x2f8dd022568af8f9f718aa37707a9b858529db56910633a160456838b6cbcbc"],
    "ETHEREALSILICA": [21, "0x68b6e23cbbd58a644700f55e96c83580921e9f521b6e5175396b53ba7910e7d"],
    "DRAGONHIDE": [22, "0x3bf856515bece3c93f5061b7941b8645f817a0acab93c758b8c7b4bc0afa3c6"],
    "ANCIENTFRAGMENT": [24, "0x0695b08ecdfdd828c2e6267da62f59e6d7543e690ef56a484df25c8566b332a5"],
    "DONKEY": [25, "0x264be95a4a2ace20add68cb321acdccd2f9f8440ee1c7abd85da44ddab01085"],
    "KNIGHT": [26, "0xac965f9e67164723c16735a9da8dbc9eb8e43b1bd0323591e87c056badf606"],
    "KNIGHT2": [27, "0x1c5593e09e65963a0bffc1aea7e7902dd2e2bdb1f7b926b4814da9cc3960f4c"],
    "KNIGHT3": [28, "0x7521799dcef3072af1e2bfa4aa3550fe1776dcc1eb4183de2055dfda54a5e8"],
    "CROSSBOWMAN": [29, "0x67e4ac00a241be06ba6afc11fa2715ec7da0c42c05a67ef6ecfcfeda725aaa8"],
    "CROSSBOWMAN2": [30, "0x65444738984a01c4eb7ab1b5236904c5a2ffdb8825d86919f284fd2d27ebf2e"],
    "CROSSBOWMAN3": [31, "0x2ebe412fb65e4e81076031024d2a5147d4837a0df43a6734170601992561014"],
    "PALADIN": [32, "0x3bc86299bee061c7c8d7546ccb62b9daf9bffc653b1508facb722c6593874bc"],
    "PALADIN2": [33, "0xc86323fea970dc3b1bdeaa212de33bc0a541cccba4110ad5ddd4d52b63d96f"],
    "PALADIN3": [34, "0x260735ee5bd162e749e8bea4fd7469eb161c8e261913ec922d37d521524c9fc"],
    "WHEAT": [35, "0x57a3f1ee475e072ce3be41785c0e889b7295d7a0dcc22b992c5b9408dbeb280"],
    "FISH": [36, "0x27719173cfe10f1aa38d2aaed0a075b6077290f1e817aa3485d2b828394f4d9"],
    "LORDS": [37, "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49"]
  }
};

const getSeasonAddresses = (chain: Chain): SeasonAddresses => {
  try {
    // Try to import from contracts utils if available
    const { getSeasonAddresses: getContractAddresses } = require("@contracts/utils");
    return getContractAddresses(chain);
  } catch (error) {
    // Fallback to hardcoded mainnet addresses for build compatibility
    console.warn("Contract utilities not available, using fallback addresses");
    return fallbackMainnetAddresses;
  }
};

export const getResourceAddresses = () => {
  const addresses = getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).resources;
  return addresses;
};

export const getSeasonPassAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).seasonPass;
};

export const getLordsAddress = () => {
  return getSeasonAddresses(env.VITE_PUBLIC_CHAIN as Chain).lords;
};
