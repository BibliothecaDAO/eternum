export interface EthplorerAddressInfoResponse {
    ETH: {
      price: {
        rate: string;
        ts: number;
      };
      rawBalance: string;
    };
    address: string;
    error: {
      code: number;
      message: string;
    };
    tokens: EthplorerToken[];
  }
  
  interface TotalStakedRealmsData {
    wallets?: {
      realmsHeld: string;
    }[];
  }
  
  interface TotalValueLocked {
    exchange: string;
    valueUsd: number;
  }
  
  interface ExchangeValue {
    exchange: string;
    value: number;
  }

interface EthplorerToken {
  tokenInfo: {
    address: string;
    decimals: string;
    symbol: string;
    name: string;
    price?: {
      rate: string;
    };
  };
  balance: number;
  rawBalance: string;
}

interface TokenTotals {
  LORDS: {
    amount: number;
    usdValue: number;
  };
  WETH: {
    amount: number;
    usdValue: number;
  };
  ETH: {
    amount: number;
    usdValue: number;
  };
  USDC: {
    amount: number;
    usdValue: number;
  };
}

export async function getTreasuryBalance(): Promise<TokenTotals> {
    function getAddressUrl(address: string) {
      return `https://api.ethplorer.io/getAddressInfo/${address}?apiKey=${import.meta.env.VITE_ETHPLORER_APIKEY}&chainId=1`;
    }
    const daoAddresses = ["0xA8e6EFaf015D424c626Cf3C23546Fcb3BD2C9f1a","0x439d859B391c38160227AEB5636Df52da789CFC1","0xBbae2e00bcc495913546Dfaf0997Fb18BF0F20fe","0xf92A1536Fec97360F674C15e557Ff60a2DBFbcDc"]
  
    if (!daoAddresses) {
      throw new Error("DAO addresses are undefined");
    }
    const fetchPromises = daoAddresses.map(async (account) => {
      const url = getAddressUrl(account);
      return await fetch(url);
    });
    const responses = await Promise.all(fetchPromises);
    const data = await Promise.all(responses.map((response) => response.json()));

    // Initialize totals
    const totals: TokenTotals = {
      LORDS: { amount: 0, usdValue: 0 },
      WETH: { amount: 0, usdValue: 0 },
      ETH: { amount: 0, usdValue: 0 },
      USDC: { amount: 0, usdValue: 0 }
    };

    // Sum up all balances
    data.forEach((account) => {
      // Add ETH balance and USD value
      const ethAmount = parseFloat(account.ETH.balance);
      const ethUsdValue = ethAmount * parseFloat(account.ETH.price.rate);
      totals.ETH.amount += ethAmount;
      totals.ETH.usdValue += ethUsdValue;

      // Add token balances
      account.tokens.forEach((token: EthplorerToken) => {
        const symbol = token.tokenInfo.symbol;
        const decimals = parseInt(token.tokenInfo.decimals);
        const balance = parseFloat(token.rawBalance) / Math.pow(10, decimals);
        const usdValue = balance * parseFloat(token.tokenInfo.price?.rate || '0');

        switch (symbol) {
          case 'LORDS':
            totals.LORDS.amount += balance;
            totals.LORDS.usdValue += usdValue;
            break;
          case 'WETH':
            totals.WETH.amount += balance;
            totals.WETH.usdValue += usdValue;
            break;
          case 'USDC':
            totals.USDC.amount += balance;
            totals.USDC.usdValue += usdValue;
            break;
        }
      });
    });

    return totals;
}