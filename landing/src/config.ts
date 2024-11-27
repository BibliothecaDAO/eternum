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
    // @dev: These are test contracts and are not used in production
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

export const chain = import.meta.env.VITE_PUBLIC_CHAIN as Chain | Chain.LOCAL;

export const seasonPassAddress = tokens[chain][Token.SEASON_PASS]?.address as `0x${string}`;
export const lordsAddress = tokens[chain][Token.LORDS]?.address as `0x${string}`;
export const realmsAddress = tokens[chain][Token.REALMS]?.address as `0x${string}`;
