import { useMintSeasonPass } from "@/hooks/use-mint-season-pass";
import { displayAddress } from "@/lib/utils";
import { useAccount } from "@starknet-react/core";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader } from "lucide-react";
import { useEffect } from "react";
import { TypeH2 } from "../typography/type-h2";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";

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
  const { mint, isMinting, isMintSuccess } = useMintSeasonPass();

  const { address, connector } = useAccount();

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 0);

      return () => clearTimeout(timer);
    } else {
      document.body.style.pointerEvents = "auto";
    }
  }, [isOpen]);

  useEffect(() => {
    if (isMintSuccess) {
      setIsOpen(false);
      deselectAllNfts();
    }
  }, [isMintSuccess, setIsOpen, deselectAllNfts]);

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
              {isMintSuccess ? `Minted ${realm_ids.length} Passes` : `Mint ${realm_ids.length} Passes`}
            </TypeH2>
            {isMintSuccess && (
              <div className="mb-4 text-center text-sm">
                Your season passes have now been minted - see them at{" "}
                <Link to="/$collection" params={{ collection: "season-passes" }}>
                  Passes
                </Link>
              </div>
            )}
          </div>
          {isMintSuccess ? (
            <Button onClick={() => setIsOpen(false)} className="mx-auto w-full lg:w-fit">
              Continue to explore Realms
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-md p-5 lg:flex-row lg:gap-5 lg:p-4 w-fill">
              <div className="text-center">
                <div className="w-full grid grid-cols-4 gap-0.5 p-4 max-h-[40vH] overflow-y-auto">
                  {realm_ids.map((realm, index) => (
                    <div className=" p-2 border rounded-md" key={realm}>
                      #{Number(realm)}
                    </div>
                  ))}
                </div>
                <>
                  {!address ? (
                    <div className="text-yellow-500 mb-2 flex items-center justify-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Connect wallet to mint
                    </div>
                  ) : (
                    <div className="text-xl mb-2 flex items-center justify-center gap-2 mt-8">
                      Passes will be sent to:
                      <Badge variant="secondary" className="flex items-center gap-2 py-1">
                        {connector?.icon && typeof connector.icon === "string" ? (
                          <img className="h-4 w-4" src={connector.icon} alt="Wallet Icon" />
                        ) : null}
                        <span className="truncate">{displayAddress(address)}</span>
                      </Badge>
                    </div>
                  )}
                  <Button
                    className="mx-auto mt-8"
                    onClick={() => {
                      if (mint) {
                        mint(realm_ids, address);
                      }
                    }}
                    disabled={!address}
                    variant="cta"
                  >
                    {isMinting && <Loader className="animate-spin pr-2" />}
                    Claim Season Pass
                  </Button>
                </>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
