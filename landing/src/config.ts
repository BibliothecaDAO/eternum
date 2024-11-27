import { env } from "../env";

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
      address: "0x31031b237b196b17179cf30154d03bfa2ed2e74731d6b1f9760b1085457861d",
      decimals: 18,
    },
    [Token.SEASON_PASS]: {
      address: "0x43e1d2187157c7744a96897c4a10303a9972c65727dbbed7348cbc6d98709a4",
    },
    [Token.REALMS]: {
      address: "0xd2674cc335684896f2b1f942e6929611acab4dc07aa03d0371226812bbc349",
    },
  },
  [Chain.LOCAL]: {
    [Token.LORDS]: {
      address: env.VITE_LORDS_ADDRESS,
      decimals: 18,
    },
    [Token.SEASON_PASS]: {
      address: env.VITE_SEASON_PASS_ADDRESS,
    },
    [Token.REALMS]: {
      address: env.VITE_REALMS_ADDRESS,
    },
  },
};

const chain = env.VITE_PUBLIC_CHAIN as Chain | Chain.LOCAL;

export const seasonPassAddress = tokens[chain][Token.SEASON_PASS]?.address as `0x${string}`;
export const lordsAddress = tokens[chain][Token.LORDS]?.address as `0x${string}`;
export const realmsAddress = tokens[chain][Token.REALMS]?.address as `0x${string}`;
