import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface EthplorerToken {
  address: string;
  decimals: string;
  symbol: string;
  name: string;
  price?: {
    rate: string;
    diff7d: string;
    marketCapUsd: string;
    volume24h: string;
  };
}

/* -------------------------------------------------------------------------- */
/*                          getLordsInfo Endpoint                             */
/* -------------------------------------------------------------------------- */

const GetLordsInfoInput = z.object({}).optional();

export const getLordsInfo = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => GetLordsInfoInput.parse(input))
  .handler(async (_ctx) => {
    const response = await fetch(
      `https://api.ethplorer.io/getTokenInfo/0x686f2404e77ab0d9070a46cdfb0b7fecdd2318b0?apiKey=${import.meta.env.VITE_ETHPLORER_APIKEY}&chainId=1`,
    );
    const data = (await response.json()) as EthplorerToken;

    return data;
  });
