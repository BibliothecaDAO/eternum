import { ConnectWalletPrompt } from "@/components/modules/connect-wallet-prompt";
import { SeasonPassesGrid } from "@/components/modules/season-passes-grid";
import TransferSeasonPassDialog from "@/components/modules/transfer-season-pass-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { seasonPassAddress } from "@/config";
import { execute } from "@/hooks/gql/execute";
import { GetAccountTokensQuery } from "@/hooks/gql/graphql";
import { GET_ACCOUNT_TOKENS } from "@/hooks/query/erc721";
import { displayAddress } from "@/lib/utils";
import { SeasonPassMint } from "@/types";
import { useAccount, useConnect } from "@starknet-react/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Badge, Loader2, MousePointerClick } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { addAddressPadding } from "starknet";

export const Route = createLazyFileRoute("/season-passes")({
  component: SeasonPasses,
});

const getSeasonPassNfts = (data: GetAccountTokensQuery | null) => {
  return data?.tokenBalances?.edges?.filter(
    (token) =>
      token?.node?.tokenMetadata.__typename == "ERC721__Token" &&
      addAddressPadding(token.node.tokenMetadata.contractAddress ?? "0x0") ===
        addAddressPadding(seasonPassAddress ?? "0x0"),
  );
};

export type TokenBalance = NonNullable<NonNullable<GetAccountTokensQuery["tokenBalances"]>["edges"]>[number];

function SeasonPasses() {
  const { connectors, connect } = useConnect();
  const { address } = useAccount();

  const [isTransferOpen, setIsTransferOpen] = useState(false);

  const [controllerAddress] = useState<string>();

  const { data, isLoading: isPassesLoading } = useSuspenseQuery({
    queryKey: ["erc721Balance", address],
    queryFn: () => (address ? execute(GET_ACCOUNT_TOKENS, { accountAddress: address }) : null),
    refetchInterval: 10_000,
  });

  const seasonPassNfts: TokenBalance[] | undefined = useMemo(() => getSeasonPassNfts(data), [data]);

  if (!address) {
    return (
      <ConnectWalletPrompt
        connectors={connectors}
        connect={connect}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {isPassesLoading && (
        <div className="flex-grow flex items-center justify-center absolute inset-0 bg-background/50 z-50">
          <Loader2 className="w-10 h-10 animate-spin" />
        </div>
      )}
      <>
        {controllerAddress && (
          <div className="text-xl py-4 flex items-center">
            Minting to:{" "}
            <Badge fontVariant="secondary" className="text-lg ml-4 py-1.5">
              <img className="w-6 pr-2" src={connectors[2].icon as string} alt="Connector Icon" />
              {displayAddress(controllerAddress)}
            </Badge>
          </div>
        )}

        <>
          {/* Page Title */}
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 pt-4">Your Season Passes</h2>
          <p className="text-center text-muted-foreground mb-6">
            View and manage your Season Pass NFTs.
          </p>
          
          {/* Beautiful Instruction Banner */}
          {seasonPassNfts && seasonPassNfts.length > 0 && (
            <div className="flex items-center justify-center bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3 mb-6 text-base text-blue-700 dark:text-blue-300 shadow-sm">
              <MousePointerClick className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>Click on any Season Pass card below to transfer it</span>
            </div>
          )}

          {/* Grid container - Removed extra bottom padding */}
          <div className="flex-grow overflow-y-auto p-4 pt-0"> 
            <div className="flex flex-col gap-2">
              <Suspense fallback={<Skeleton>Loading</Skeleton>}>
                {/* Pass setIsTransferOpen to the grid */}
                {seasonPassNfts && <SeasonPassesGrid seasonPasses={seasonPassNfts} setIsTransferOpen={setIsTransferOpen} />}
              </Suspense>
            </div>
          </div>
          
          {/* Render Transfer Dialog conditionally */}
          {isTransferOpen && seasonPassNfts && (
            <TransferSeasonPassDialog
              isOpen={isTransferOpen}
              setIsOpen={setIsTransferOpen}
              seasonPassMints={seasonPassNfts as SeasonPassMint[]}
            />
          )}
        </>
      </>
    </div>
  );
}
