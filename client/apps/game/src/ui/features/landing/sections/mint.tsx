import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useUser } from "@/pm/hooks/dojo/user";
import { Button, Panel, TextInput } from "@/ui/design-system/atoms";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/design-system/atoms/table";
import { HStack, VStack } from "@pm/ui";
import { useAccount } from "@starknet-react/core";
import { toast } from "sonner";
import { Call, uint256 } from "starknet";

import { MarketsProviders, MarketsSection } from "./markets";
import { TokenIcon } from "./markets/TokenIcon";

const MintContent = () => {
  const { account } = useAccount();
  const {
    tokens: { tokens, getBalance, toDecimal, refetchBalances },
  } = useUser();
  const [recipient, setRecipient] = useState<string>(account?.address || "");
  const [minting, setMinting] = useState<string | null>(null);

  const lordsTokens = useMemo(() => {
    const target = "0x062cbbb9e30d90264ac63586d4f000be3cf5c178f11ae48f11f8b659eb060ac5";
    const found = tokens.filter((token) => BigInt(token.contract_address) === BigInt(target));
    if (found.length > 0) return found;

    // Fallback token so minting stays available even without an existing balance entry
    return [
      {
        contract_address: target,
        token_id: "0x0",
        name: "Mock LORDS",
        symbol: "LORDS",
        decimals: 18,
        metadata: "",
      } as any,
    ];
  }, [tokens]);

  const onMint = async (contractAddress: string, decimals: number, symbol: string) => {
    if (!account) {
      toast.error("Connect a wallet to mint tokens.");
      return;
    }

    const target = (recipient || account.address).trim();
    if (!target) {
      toast.error("Enter a recipient address.");
      return;
    }

    const amount = 100n * 10n ** BigInt(decimals || 0);
    const { low, high } = uint256.bnToUint256(amount);

    const call: Call = {
      contractAddress,
      entrypoint: "mint",
      calldata: [target, low, high],
    };

    setMinting(contractAddress);
    try {
      await account.execute([call]);
      toast.success(`Minted 100 ${symbol} to ${target === account.address ? "your wallet" : "the recipient"}.`);
      await refetchBalances?.();
    } catch (error) {
      console.error("Mint failed", error);
      toast.error("Mint failed. Check console for details.");
    } finally {
      setMinting(null);
    }
  };

  return (
    <VStack className="gap-6">
      <HStack className="items-center justify-between gap-3">
        <Link className="flex items-center gap-2 text-sm font-semibold text-gold hover:text-white" to="/markets">
          <span>&larr;</span>
          <span>Back to markets</span>
        </Link>
        <Button variant="secondary" size="sm" onClick={() => setRecipient(account?.address || "")}>
          Use my wallet
        </Button>
      </HStack>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.08em] text-white/60">Secret terminal</div>
          <h1 className="text-2xl font-semibold text-white">Mint fake LORDS</h1>
          <p className="text-sm text-gold/70">Drop 100 test tokens to yourself or to any address.</p>
        </div>
      </div>

      <Panel tone="overlay" padding="lg" radius="xl" className="space-y-4">
        <VStack className="gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-white/70">Recipient address</label>
          <TextInput
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="bg-black/30"
          />
        </VStack>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Token</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lordsTokens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-gold/70">
                  Loading token data... Using fallback Mock LORDS.
                </TableCell>
              </TableRow>
            ) : null}
            {lordsTokens.map((token) => {
              const balance = getBalance(token);
              const formattedBalance = balance ? toDecimal(token, balance) : 0;
              const isMinting = minting === token.contract_address;

              return (
                <TableRow key={`${token.contract_address}-${token.token_id || 0}`}>
                  <TableCell>
                    <HStack className="items-center gap-2">
                      <TokenIcon token={token} className="h-5 w-5" />
                      <span className="font-semibold text-white">{token.symbol}</span>
                      <span className="text-xs text-white/60">({token.decimals} dec)</span>
                    </HStack>
                  </TableCell>
                  <TableCell className="text-right text-white/80">{formattedBalance.toFixed(4)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => onMint(token.contract_address, token.decimals || 18, token.symbol)}
                      disabled={isMinting}
                      isLoading={isMinting}
                    >
                      {isMinting ? "Minting..." : "Mint 100"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>
    </VStack>
  );
};

export const LandingMint = () => {
  return (
    <MarketsProviders>
      <MarketsSection description="A hidden workbench to mint mock LORDS for testing.">
        <MintContent />
      </MarketsSection>
    </MarketsProviders>
  );
};

export default LandingMint;
