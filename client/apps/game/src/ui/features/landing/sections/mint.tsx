import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useUser } from "@/pm/hooks/dojo/user";
import { formatUnits } from "@/pm/utils";
import { Button, Panel, TextInput } from "@/ui/design-system/atoms";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/design-system/atoms/table";
import { HStack, VStack } from "@pm/ui";
import { useAccount } from "@starknet-react/core";
import { toast } from "sonner";
import { Call, uint256 } from "starknet";

import { getPredictionMarketConfig } from "@/pm/prediction-market-config";
import { MarketsProviders, MarketsSection } from "./markets";
import { TokenIcon } from "./markets/token-icon";

const MintContent = () => {
  const { account } = useAccount();
  const { lordsBalance, refetchLordsBalance } = useUser();
  const [recipient, setRecipient] = useState<string>(account?.address || "");
  const [minting, setMinting] = useState<string | null>(null);

  const lordsToken = useMemo(() => {
    const config = getPredictionMarketConfig();
    return {
      contract_address: config.collateralToken,
      token_id: "0x0",
      name: "Mock LORDS",
      symbol: "LORDS",
      decimals: 18,
      metadata: "",
    };
  }, []);

  const onMint = async () => {
    if (!account) {
      toast.error("Connect a wallet to mint tokens.");
      return;
    }

    const target = (recipient || account.address).trim();
    if (!target) {
      toast.error("Enter a recipient address.");
      return;
    }

    const amount = 100n * 10n ** BigInt(lordsToken.decimals);
    const { low, high } = uint256.bnToUint256(amount);

    const call: Call = {
      contractAddress: lordsToken.contract_address,
      entrypoint: "mint",
      calldata: [target, low, high],
    };

    setMinting(lordsToken.contract_address);
    try {
      await account.execute([call]);
      toast.success(
        `Minted 100 ${lordsToken.symbol} to ${target === account.address ? "your wallet" : "the recipient"}.`,
      );
      refetchLordsBalance?.();
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
        <Button variant="secondary" size="md" onClick={() => setRecipient(account?.address || "")}>
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
            onChange={(value) => setRecipient(value)}
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
            <TableRow>
              <TableCell>
                <HStack className="items-center gap-2">
                  <TokenIcon token={lordsToken} size={20} />
                  <span className="font-semibold text-white">{lordsToken.symbol}</span>
                  <span className="text-xs text-white/60">({lordsToken.decimals} dec)</span>
                </HStack>
              </TableCell>
              <TableCell className="text-right text-white/80">
                {formatUnits(lordsBalance, lordsToken.decimals, 4)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={onMint}
                  disabled={minting === lordsToken.contract_address}
                  isLoading={minting === lordsToken.contract_address}
                >
                  {minting === lordsToken.contract_address ? "Minting..." : "Mint 100"}
                </Button>
              </TableCell>
            </TableRow>
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
