import { useAccountStore } from "@/hooks/store/use-account-store";
import { Button } from "@/ui/design-system/atoms";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { type RawArgsObject, Call, CallData, type Uint256, uint256 } from "starknet";

const tryBetterErrorMsg = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Something went wrong while creating the market.";
};

// Placeholder values until the market form is wired up
const DEFAULT_MARKET_ADDRESS = "";
const DEFAULT_COLLATERAL_TOKEN = "0x062cbbb9e30d90264ac63586d4f000be3cf5c178f11ae48f11f8b659eb060ac5";
const DEFAULT_CREATE_MARKET_PARAMS: RawArgsObject = {
  oracle: "0x0693278fb06d7041f884c50cb9d0e2d4620ed16f282cf8c76fddb712ef1060d2",
  collateral_token: DEFAULT_COLLATERAL_TOKEN,
  model: {
    variant: {
      Vault: {
        initial_repartition: [1, 1, 1],
        funding_amount: {
          low: "0x56bc75e2d63100000",
          high: "0x0",
        },
        fee_curve: {
          variant: {
            Linear: {
              start: 0,
              end: 2000,
            },
          },
        },
        fee_share_curve: {
          variant: {
            Linear: {
              start: 10000,
              end: 0,
            },
          },
        },
      },
    },
  },
  oracle_params: [
    "0",
    "3038007332165199338266024285300727230862136446917353564549635676187981469583",
    "0x0",
    "0x6765745f736561736f6e5f77696e6e6572",
    "0x11",
    "1",
    "0",
  ],
  oracle_extra_params: ["0"],
  oracle_value_type: {
    variant: {
      ContractAddress: {},
    },
  },
  typ: {
    variant: {
      Categorical: {
        variant: {
          ValueEq: [
            {
              low: "0x890aa16037dff87c3920ca6307b1d199",
              high: "0x18f1a5171cf91eb2c8075af1f9e29a2",
            },
            {
              low: "0x3451b2d1f0105a76b2d5716a49cf0f51",
              high: "0x2d589dd6d86e7a70f26e21834c4ae87",
            },
          ],
        },
      },
    },
  },
  start_at: "1764690120",
  end_at: "1764697320",
  resolve_at: "1764700920",
  title: {
    data: [],
    pending_word: "0x626c69747a20746573742033",
    pending_word_len: 12,
  },
  question: {
    data: [],
    pending_word: "0x00",
    pending_word_len: 0,
  },
  creator_fee: "10",
};

const toFundingAmount = (value: number | bigint | Uint256 | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "bigint" || typeof value === "number") {
    return BigInt(value);
  }

  if (typeof value === "object" && "low" in value && "high" in value) {
    return uint256.uint256ToBN(value);
  }

  return undefined;
};

type MarketForm = {
  collateralToken: { contract_address: string } | null;
  model: { unwrap: () => RawArgsObject } | null;
};

export const LandingMarkets = () => {
  const account = useAccountStore((state) => state.account);

  const form = useMemo<MarketForm>(
    () => ({
      collateralToken: { contract_address: DEFAULT_COLLATERAL_TOKEN },
      model: { unwrap: () => DEFAULT_CREATE_MARKET_PARAMS },
    }),
    [],
  );

  const createMarketParams = useMemo<RawArgsObject | null>(() => form.model?.unwrap() ?? null, [form.model]);
  const marketAddress = DEFAULT_MARKET_ADDRESS;

  const onCreate = useCallback(async () => {
    if (!account) {
      toast.error("Connect a wallet to create a market.");
      return;
    }

    if (!marketAddress) {
      toast.error("Market contract address is not configured.");
      return;
    }

    if (!form.collateralToken?.contract_address || !createMarketParams) {
      toast.error("Market details are incomplete.");
      return;
    }

    const fundingAmount =
      (createMarketParams["funding_amount"] as number | bigint | Uint256 | undefined) ??
      (createMarketParams.model as { variant?: { Vault?: { funding_amount?: Uint256 | bigint | number } } })?.variant
        ?.Vault?.funding_amount;
    const normalizedFundingAmount = toFundingAmount(fundingAmount);
    if (normalizedFundingAmount === undefined) {
      toast.error("Funding amount is missing.");
      return;
    }

    console.log("onCreate", form);

    const approveCall: Call = {
      contractAddress: form.collateralToken.contract_address,
      entrypoint: "approve",
      calldata: [marketAddress, uint256.bnToUint256(normalizedFundingAmount)],
    };

    const createMarketCall: Call = {
      contractAddress: marketAddress,
      entrypoint: "create_market",
      // compile calldata or controller breaks
      calldata: CallData.compile([createMarketParams]),
    };

    try {
      await account.estimateInvokeFee([approveCall, createMarketCall], {
        blockIdentifier: "pre_confirmed",
      });

      const result = await account.execute([approveCall, createMarketCall]);

      if ("waitForTransaction" in account && typeof account.waitForTransaction === "function") {
        await account.waitForTransaction(result.transaction_hash);
      }

      toast.success("Market Created !");
    } catch (e: any) {
      console.log(e);
      toast.error(tryBetterErrorMsg(e));
    }
  }, [account, createMarketParams, form, marketAddress]);

  return (
    <section aria-label="Prediction markets" className="w-full">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-gold/30 bg-black/40 p-6 text-center shadow-lg shadow-black/30">
        <h2 className="text-2xl font-semibold text-gold">Prediction Markets</h2>
        <p className="text-sm text-gold/70">Create and browse markets. More coming soon.</p>
        <Button onClick={onCreate} className="w-full sm:w-auto">
          Create Market
        </Button>
      </div>
    </section>
  );
};
