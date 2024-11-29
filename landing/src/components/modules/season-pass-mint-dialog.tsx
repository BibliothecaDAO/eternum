import { useMintSeasonPass } from "@/hooks/useMintSeasonPass";
import { useAccount } from "@starknet-react/core";
import { Link } from "@tanstack/react-router";
import { Loader } from "lucide-react";
import { useEffect } from "react";
import { TypeH2 } from "../typography/type-h2";
import { TypeH3 } from "../typography/type-h3";
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
  const { mint, isMinting } = useMintSeasonPass();

  const { address } = useAccount();

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
          {isSuccess ? (
            <Button onClick={() => setIsOpen(false)} className="mx-auto w-full lg:w-fit">
              Continue to explore Realms
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-md bg-card p-5 lg:flex-row lg:gap-5 lg:p-4">
              <div className="text-center">
                <div className="text-lg font-semibold">Mint passes to compete in Season 0 of Eternum</div>
                <div className="w-full my-4">
                  <hr className="my-4" />
                  <div className="text-left gap-2 mt-6">
                    <TypeH3>Realms</TypeH3>
                    <div>
                      {realm_ids.map((realm, index) => (
                        <span key={realm}>
                          #{Number(realm)}
                          {index < realm_ids.length - 1 && ", "}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {mint && (
                  <Button
                    className="mx-auto"
                    onClick={() => {
                      mint(realm_ids, address);
                      deselectAllNfts();
                      setIsOpen(false);
                    }}
                    disabled={!address}
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
