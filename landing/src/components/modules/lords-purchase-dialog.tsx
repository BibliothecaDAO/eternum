import LordsIcon from "@/assets/icons/Lords.svg?react";
import useDebounce from "@/hooks/use-debounce";
import type { Quote } from "@avnu/avnu-sdk";
import { executeSwap, fetchQuotes } from "@avnu/avnu-sdk";
import { useAccount, useBalance } from "@starknet-react/core";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther, formatUnits, parseEther, parseUnits } from "viem";

//import { LORDS } from "@realms-world/constants";

//import { TokenBalance } from "../bridge/TokenBalance";
import { Chain, chain, lordsAddress, SupportedToken, supportedTokens } from "@/config";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { TokenBalance } from "./token-balance";

const AVNU_OPTIONS = {
  baseUrl: `https://${chain == Chain.MAINNET ? "starknet" : "sepolia"}.api.avnu.fi`,
};

export const LordsPurchaseDialog = ({
  initialLordsSupply,
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  initialLordsSupply?: string | null;
  showSwitchButton?: boolean;
}) => {
  const [sellAmount, setSellAmount] = useState<string>();
  const [buyAmount, setBuyAmount] = useState<string>();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const { address, account } = useAccount();
  //const { balances, l2loading } = useWalletsProviderContext();
  const [selectedToken, setSelectedToken] = useState<SupportedToken>(SupportedToken.ETH);

  const selectedTokenObj = useMemo(() => {
    return supportedTokens[chain][selectedToken];
  }, [selectedToken]);

  const { data, isLoading } = useBalance({
    address,
    token: selectedTokenObj?.address as `0x${string}` | undefined,
    watch: false,
  });
  const isDebouncing = useDebounce(sellAmount, 350) !== sellAmount;
  const isBuyInputDebouncing = useDebounce(buyAmount, 350) !== buyAmount;

  useEffect(() => {
    if (initialLordsSupply) setBuyAmount(initialLordsSupply);
  }, [initialLordsSupply]);

  const fetchSellAmountFromBuyAmount = useCallback(() => {
    if (!selectedTokenObj || !buyAmount || isBuyInputDebouncing) return;
    setLoading(true);
    const params = {
      sellTokenAddress: selectedTokenObj.address,
      buyTokenAddress: lordsAddress,
      sellAmount: parseUnits("1", 18),
      takerAddress: address,
      size: 1,
    };

    fetchQuotes(params, AVNU_OPTIONS)
      .then((quotes) => {
        setLoading(false);
        if (quotes[0]) {
          // cross-multiplication
          // For 1 unit of tokenA => you get y amount of tokenB
          // Then for x, a specific amount of tokenB => You need to have 1 * x / y
          const sellAmountFromBuyAmount = (parseUnits("1", 18) * parseUnits(buyAmount, 18)) / quotes[0]?.buyAmount;

          setSellAmount(formatEther(sellAmountFromBuyAmount));
        }
      })
      .catch(() => setLoading(false));
  }, [address, isBuyInputDebouncing, selectedTokenObj, buyAmount]);

  const fetchAvnuQuotes = useCallback(() => {
    console.log(sellAmount);
    if (!selectedTokenObj || !sellAmount || isDebouncing || parseUnits(sellAmount, selectedTokenObj.decimals) === 0n)
      return;
    setLoading(true);
    const params = {
      sellTokenAddress: selectedTokenObj.address ?? "0x",
      buyTokenAddress: lordsAddress,
      sellAmount: parseUnits(sellAmount, selectedTokenObj.decimals),
      takerAddress: address,
      size: 1,
    };
    console.log(params);
    fetchQuotes(params, AVNU_OPTIONS)
      .then((quotes) => {
        setLoading(false);
        setQuotes(quotes);
      })
      .catch(() => setLoading(false));
  }, [address, isDebouncing, selectedTokenObj, sellAmount]);

  const sellBalance = data?.value ?? 0;

  const handleChangeBuyInput = (event: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage("");
    setQuotes([]);
    setBuyAmount(event.target.value);
  };

  const handleTokenSelect = (event: string) => {
    setLoading(true);
    setQuotes([]);
    setSelectedToken(event);
  };

  useEffect(() => {
    if (sellAmount && selectedTokenObj && !isDebouncing) {
      fetchAvnuQuotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTokenObj, isDebouncing, sellAmount]);

  useEffect(() => {
    if (buyAmount && selectedTokenObj && !isBuyInputDebouncing) {
      fetchSellAmountFromBuyAmount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTokenObj, isBuyInputDebouncing, buyAmount]);

  const handleSwap = () => {
    if (!account || !sellAmount || !quotes[0]) return;
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);
    executeSwap(account, quotes[0], {}, AVNU_OPTIONS)
      .then(() => {
        setSuccessMessage("success");
        setLoading(false);
        setQuotes([]);
      })
      .catch((error: Error) => {
        setLoading(false);
        setErrorMessage(error.message);
      });
  };

  /*if (!account) {
    return <button onClick={handleConnect}>Connect Wallet</button>
  }*/

  const renderTokensInput = () => {
    return (
      <div className="flex">
        <Input
          onChange={handleChangeBuyInput}
          placeholder="0"
          type="text"
          className="bg-dark-brown text-2xl w-full outline-none h-16 border-none "
          disabled={loading}
          id="buy-amount"
          value={quotes[0] ? formatUnits(quotes[0].sellAmount, selectedTokenObj?.decimals ?? 18) : sellAmount}
        />

        <Select value={selectedToken} onValueChange={handleTokenSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Select Token" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(supportedTokens[chain] || {}).map((token, index) => (
              <SelectItem key={index} value={token.symbol ?? ""}>
                <span className="flex items-center pr-6 text-lg">
                  <img className="mr-2 w-6 h-6" src={token.logoURI} width={20} height={20} alt={token.name ?? ""} />
                  {token.symbol}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderLordsInput = () => {
    return (
      <div className="relative w-full">
        <Input
          onChange={handleChangeBuyInput}
          placeholder="0"
          type="text"
          className="bg-dark-brown text-2xl w-full outline-none h-16 border-none "
          disabled={loading}
          id="buy-amount"
          value={quotes[0] ? formatEther(quotes[0].buyAmount) : buyAmount}
        />

        <div className="absolute right-0 top-0 flex">
          <LordsIcon className="h-14 w-14 mt-2 fill-white" />
        </div>
      </div>
    );
  };

  const buttonContent = () => {
    switch (true) {
      case sellAmount === "0" || !sellAmount:
        return "Enter amount";
      case loading:
        return <p>Loading...</p>;
      case parseEther(sellAmount ?? "0") > sellBalance:
        return "Insufficient Balance";
      case !!quotes[0]:
        return "Swap";

      default:
        return null; // Or any default case you'd like to handle
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="justify-normal text-primary lg:justify-center"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogTitle>Purchase Lords</DialogTitle>
        <div className="rounded border bg-black/20 p-4 focus-within:!border-bright-yellow/80 hover:border-bright-yellow/40">
          <p className="text-sm">You pay</p>
          {renderTokensInput()}
          <div className="flex justify-between">
            <span className="text-sm text-bright-yellow/50">
              {quotes[0] && `≈ $${quotes[0]?.buyAmountInUsd.toFixed(2)}`}
            </span>
            <TokenBalance
              onClick={() => setSellAmount(formatEther(BigInt(sellBalance)))}
              balance={sellBalance}
              symbol=""
              isLoading={isLoading}
            />
          </div>
        </div>

        <div className="mt-4 rounded border bg-black/20 p-4 focus-within:!border-bright-yellow/80 hover:border-bright-yellow/40">
          <p className="text-sm">You receive</p>
          {renderLordsInput()}
          <span className="text-sm text-bright-yellow/50">
            {quotes[0] && `≈ $${quotes[0]?.sellAmountInUsd.toFixed(2)}`}
          </span>
        </div>
        {!account ? (
          "Login to swap"
        ) : (
          <Button
            disabled={loading || !sellAmount || parseEther(sellAmount) > sellBalance}
            onClick={handleSwap}
            className="mt-2 w-full"
          >
            {buttonContent()}
          </Button>
        )}
        {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
        {successMessage && <p style={{ color: "green" }}>Success</p>}
      </DialogContent>
    </Dialog>
  );
};
