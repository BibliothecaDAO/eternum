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
      address: "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
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

export enum SupportedToken {
  ETH = "ETH",
  WETH = "WETH",
  USDC = "USDC",
  USDT = "USDT",
  STRK = "STRK",
}

export const supportedTokens: {
  [key in Chain]: {
    [key in SupportedToken]?: {
      address: string;
      decimals: number;
      symbol: string;
      name: string;
      logoURI: string;
      isNative?: boolean;
    };
  };
} = {
  [Chain.MAINNET]: {
    [SupportedToken.ETH]: {
      address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      logoURI: "https://raw.githubusercontent.com/SetProtocol/uniswap-tokenlist/0d9233eef112388ef7e261cb88413894fd832679/assets/tokensets/coin-icons/eth.svg",
      isNative: true
    },
    [SupportedToken.USDC]: {
      address: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      logoURI: "https://raw.githubusercontent.com/SetProtocol/uniswap-tokenlist/0d9233eef112388ef7e261cb88413894fd832679/assets/tokensets/coin-icons/usdc.svg"
    },
    [SupportedToken.USDT]: {
      address: "0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8",
      name: "Tether USD",
      symbol: "USDT",
      decimals: 6,
      logoURI: "https://raw.githubusercontent.com/SetProtocol/uniswap-tokenlist/0d9233eef112388ef7e261cb88413894fd832679/assets/tokensets/coin-icons/usdt.svg"
    },
    [SupportedToken.STRK]: {
      address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
      name: "Starknet Token",
      symbol: "STRK",
      decimals: 18,
      logoURI: "https://raw.githubusercontent.com/SetProtocol/uniswap-tokenlist/0d9233eef112388ef7e261cb88413894fd832679/assets/tokensets/coin-icons/eth.svg"
    }
  },
  [Chain.SEPOLIA]: {
    // Add sepolia tokens here if needed
  },
  [Chain.LOCAL]: {
    
  }
};

// Helper exports if needed
export const getSupportedTokenAddress = (token: SupportedToken) => 
  supportedTokens[chain][token]?.address as `0x${string}`;
