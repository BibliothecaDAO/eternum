export enum Chain {
  MAINNET = "mainnet",
  SEPOLIA = "sepolia",
  LOCAL = "local",
}

export enum Token {
  LORDS = "LORDS",
  SEASON_PASS = "SEASON_PASS",
  REALMS = "REALMS",
}

export const tokens: {
  [key in Chain]: {
    [Token.LORDS]?: {
      address: string;
      decimals: number;
    };
    [Token.SEASON_PASS]?: {
      address: string;
    };
    [Token.REALMS]?: {
      address: string;
    };
  };
} = {
  [Chain.MAINNET]: {
    [Token.LORDS]: {
      address: "",
      decimals: 18,
    },
  },
  [Chain.SEPOLIA]: {
    [Token.LORDS]: {
      address: "0x019c92fa87f4d5e3be25c3dd6a284f30282a07e87cd782f5fd387b82c8142017",
      decimals: 18,
    },
    [Token.SEASON_PASS]: {
      address: "0x4454e6466f51f7a2c21e38a99e0219ee259ee3162c33bfe778ae5f89032959d",
    },
    [Token.REALMS]: {
      address: "0x3e64aa2c669ffd66a1c78d120812005d8f7e03b75696dd9c0f06e8def143844",
    },
  },
  [Chain.LOCAL]: {
    [Token.LORDS]: {
      address: import.meta.env.VITE_LORDS_ADDRESS,
      decimals: 18,
    },
    [Token.SEASON_PASS]: {
      address: import.meta.env.VITE_SEASON_PASS_ADDRESS,
    },
    [Token.REALMS]: {
      address: import.meta.env.VITE_REALMS_ADDRESS,
    },
  },
};

const chain = import.meta.env.VITE_PUBLIC_CHAIN as Chain | Chain.LOCAL;

export const seasonPassAddress = tokens[chain][Token.SEASON_PASS]?.address as `0x${string}`;
export const lordsAddress = tokens[chain][Token.LORDS]?.address as `0x${string}`;
