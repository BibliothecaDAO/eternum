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
      address: "0x033edb0e78c0f542976f55a877d228cd32eb5db767472e786e5f67fa4b8b90e5",
      decimals: 18,
    },
  },
  [Chain.SEPOLIA]: {
    [Token.LORDS]: {
      address: "0x4a923a8d844846dc34b0ea3d2ec95adf2c5569dd1b755f6a3285328bc5428e9",
      decimals: 18,
    },
    [Token.SEASON_PASS]: {
      address: "0x58621115ef085cd1115d304a57eae922a7c3850d0b2cecad945c2e93da2073e",
    },
    [Token.REALMS]: {
      address: "0x61f0d0809b4bac7d25252621e7372b9b5755af07395518b9c4a5e9ad4d4ce02",
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
