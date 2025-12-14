import { getContractByName } from "@dojoengine/core";
import { ClauseBuilder, ToriiQueryBuilder } from "@dojoengine/sdk";
import { Token, TokenBalance } from "@dojoengine/torii-wasm";
import { useEffect, useMemo, useState } from "react";
import { addAddressPadding } from "starknet";
import { Market, MarketCreated, VaultDenominator } from "../../bindings";
import { MarketClass } from "../../class";
import { useConfig } from "../../providers";
import { deepEqual } from "../../utils";
import { useDojoSdk } from "../dojo/use-dojo-sdk";
import { useTokens } from "../dojo/use-tokens";
// import { useTokens } from "../dojo/use-tokens";

export const useAllPositions = (address?: string) => {
  const { sdk } = useDojoSdk();

  // const { getContract } = useDojoConfig();
  const { registeredTokens } = useConfig();

  const { config: dojoConfig } = useDojoSdk();
  const vaultPositionsAdress = getContractByName(dojoConfig.manifest, "pm", "VaultPositions").address;
  const vaultFeesAddress = getContractByName(dojoConfig.manifest, "pm", "VaultFees").address;

  console.log({ vaultPositionsAdress, vaultFeesAddress });

  const { tokens, balances } = useTokens(
    {
      accountAddresses: address ? [address] : [],
      contractAddresses: [vaultPositionsAdress, vaultFeesAddress],
      tokenIds: [],
      pagination: {
        cursor: undefined,
        direction: "Backward",
        limit: 1_000,
        order_by: [],
      },
    },
    true,
  );

  const [markets, setMarkets] = useState<MarketClass[]>([]);
  const [balancesFull, setBalancesFull] = useState<
    {
      balance: TokenBalance;
      token: Token;
      metadata?: { market_id?: string };
    }[]
  >([]);

  useEffect(() => {
    const newBalances = balances.flatMap((balance: TokenBalance) => {
      const token = tokens.find(
        (t: Token) =>
          BigInt(t.contract_address) === BigInt(balance.contract_address) &&
          BigInt(t.token_id || 0) === BigInt(balance.token_id || 0),
      );
      if (!token) return [];
      if (BigInt(balance.balance) === 0n) return [];

      let metadata = { market_id: undefined };
      try {
        metadata = JSON.parse(token.metadata);
      } catch (e) {
        // console.log(e);
      }

      return [
        {
          balance,
          token,
          metadata,
        },
      ];
    });

    if (!deepEqual(balancesFull, newBalances)) {
      setBalancesFull(newBalances);
    }
  }, [balances]);

  useEffect(() => {
    const initAsync = async () => {
      const marketIds = Array.from(
        new Set(balancesFull.flatMap((i) => (i.metadata?.market_id ? [i.metadata.market_id] : []))),
      ).map((i) => addAddressPadding(i));

      const marketEntities = await sdk.getEntities({
        query: new ToriiQueryBuilder()
          .withEntityModels(["pm-Market", "pm-VaultDenominator"])
          .withClause(new ClauseBuilder().where("pm-Market", "market_id", "In", [...marketIds]).build())
          .includeHashedKeys(),
      });

      const marketCreatedEntities = await sdk.getEventMessages({
        query: new ToriiQueryBuilder()
          .withEntityModels(["pm-MarketCreated"])
          .withClause(new ClauseBuilder().where("pm-MarketCreated", "market_id", "In", [...marketIds]).build())
          .includeHashedKeys(),
      });

      const markets = marketEntities.getItems().flatMap((i) => {
        const item = i.models.pm.Market as Market;
        return item ? [item] : [];
      });

      const marketsCreated = marketCreatedEntities.getItems().flatMap((i) => {
        const item = i.models.pm.MarketCreated as MarketCreated;
        return item ? [item] : [];
      });

      const vaultDenominators = marketEntities.getItems().flatMap((i) => {
        const item = i.models.pm.VaultDenominator as VaultDenominator;
        return item ? [item] : [];
      });

      const marketFull = markets.map((market) => {
        const marketCreated = marketsCreated.find((i) => i.market_id === market.market_id)!;
        const vaultDenominator = vaultDenominators.find((i) => i.market_id === market.market_id)!;

        return new MarketClass({
          market,
          marketCreated,
          collateralToken: registeredTokens.find(
            (i) => BigInt(i.contract_address) === BigInt(market.collateral_token),
          )!,
          vaultDenominator,
        });
      });

      if (!deepEqual(markets, marketFull)) {
        setMarkets(marketFull);
      }
    };

    if (balancesFull && balancesFull.length > 0) {
      initAsync();
    }
  }, [balancesFull]);

  const { vaultPositionsBalances, vaultFeesBalances } = useMemo(() => {
    return {
      vaultPositionsBalances: balancesFull.filter(
        (i) => BigInt(i.token.contract_address) === BigInt(vaultPositionsAdress),
      ),
      vaultFeesBalances: balancesFull.filter((i) => BigInt(i.token.contract_address) === BigInt(vaultFeesAddress)),
    };
  }, [balancesFull]);

  return {
    markets,
    vaultPositionsBalances,
    vaultFeesBalances,
  };
};
