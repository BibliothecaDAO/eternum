import { Link } from "@tanstack/react-router";
import { TypeH2 } from "../typography/type-h2";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
//import TokenActionsTokenOverview from "~/app/token/[contractAddress]/[tokenId]/components/token-actions-token-overview";
//import type { CollectionToken, Token } from "~/types";
import { useMintSeasonPass } from "@/hooks/useMintSeasonPass";
import { checkCartridgeConnector } from "@/lib/utils";
import { useConnect } from "@starknet-react/core";
import { Loader } from "lucide-react";
import { useState } from "react";
import { StarknetProvider } from "../providers/Starknet";
import CustomIframe from "../ui/custom-iframe";
import { CartridgeConnectButton } from "./cartridge-connect-button";

interface SeasonPassMintDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isSuccess: boolean;
  deselectAllNfts: () => void;
  realm_ids: string[];
}

export default function SeasonPassMintDialog({
  isOpen,
  setIsOpen,
  deselectAllNfts,
  isSuccess,
  realm_ids,
}: SeasonPassMintDialogProps) {
  const { mint, isMinting } = useMintSeasonPass();
  const { connector } = useConnect();
  const [account, setAccount] = useState();

  const checkCartridge = checkCartridgeConnector(connector);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="justify-normal lg:justify-center"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">Mint Season Passes</DialogTitle>
        <div className="flex flex-col text-primary text-center items-center">
          <div className="flex flex-col gap-4">
            <TypeH2 className="border-b-0 text-center">
              {isSuccess ? `Minted ${realm_ids.length} Passes` : `Mint ${realm_ids.length} Passes`}
            </TypeH2>
            {isSuccess && (
              <div className="mb-4 text-center text-sm">
                Your season passes have now been minted - see them at <Link href="/passes">Passes</Link>
              </div>
            )}
          </div>
          {/*<TokenActionsTokenOverview
            token={token}
            amount={formatEther(BigInt(price ?? 0))}
        />*/}
          {isSuccess ? (
            <Button onClick={() => setIsOpen(false)} className="mx-auto w-full lg:w-fit">
              Continue to explore Realms
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-md bg-card p-5 lg:flex-row lg:gap-5 lg:p-4">
              <div className="text-center">
                <div className="text-lg font-semibold">Mint your passes to compete in Season 0 of Eternum</div>
                <div className="w-full my-4">
                  {!checkCartridge && (
                    <div className="w-full h-full relative">
                      <CustomIframe
                        style={{ width: "100%", height: "100%", overflow: "auto" }}
                        sandbox="allow-same-origin allow-scripts allow-modal"
                        title="A custom made iframe"
                      >
                        <StarknetProvider>
                          <CartridgeConnectButton className="w-full" />
                        </StarknetProvider>
                      </CustomIframe>
                    </div>
                  )}
                  {realm_ids.map((realm, index) => (
                    <span key={realm}>
                      #{Number(realm)}
                      {index < realm_ids.length - 1 && ", "}
                    </span>
                  ))}
                </div>
                {mint && (
                  <Button
                    className="mx-auto"
                    onClick={() => {
                      mint(realm_ids);
                      deselectAllNfts();
                      setIsOpen(false);
                    }}
                    variant="cta"
                  >
                    {isMinting && <Loader className="animate-spin pr-2" />} Mint Season Passes
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
