import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useSelectedPassesStore } from "@/stores/selected-passes";
import { RESOURCE_RARITY, ResourcesIds } from "@bibliothecadao/types";
import { useAccount, useConnect } from "@starknet-react/core";
import { formatUnits, parseEther } from "viem";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { ConnectWalletPrompt } from "./connect-wallet-prompt";

interface PurchaseDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  collection: string;
}

export const PurchaseDialog = ({ isOpen, onOpenChange, collection }: PurchaseDialogProps) => {
  const { selectedPasses, getTotalPrice, clearSelection } = useSelectedPassesStore("$collection" + collection);
  const totalPrice = getTotalPrice();
  const { acceptOrders } = useMarketplace();

  const { connectors, connect } = useConnect();
  const { address } = useAccount();

  const handlePurchase = async () => {
    // TODO: Implement purchase logic
    await acceptOrders({
      order_ids: selectedPasses.map((pass) => BigInt(pass.order_id ?? 0)),
      totalPrice: BigInt(parseEther(totalPrice.toString())),
    });
    console.log("Purchasing passes:", selectedPasses);
    // After successful purchase:
    clearSelection();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-gold">Purchase {collection}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-gold">
          {/* Selected Passes List */}
          <div className="max-h-[400px] overflow-y-auto space-y-3">
            {selectedPasses.map((pass) => {
              const metadata = pass.metadata;
              const price = pass.best_price_hex ? Number(formatUnits(BigInt(pass.best_price_hex), 18)) : 0;
              const image = metadata?.image?.startsWith("ipfs://")
                ? metadata?.image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")
                : metadata?.image;
              return (
                <div key={pass.token_id} className="flex items-center gap-4 p-3 bg-card rounded-lg ">
                  <img src={image} alt={`Pass #${pass.token_id}`} className="w-16 h-16 object-cover rounded-md" />
                  <div className="flex-1">
                    <h4 className="font-medium text-gold">{metadata?.name || `Pass #${pass.token_id}`}</h4>
                    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {metadata?.attributes
                          ?.filter((attribute: { trait_type: string }) => attribute.trait_type === "Resource")
                          .sort(
                            (a: { value: { toString: () => string } }, b: { value: { toString: () => string } }) => {
                              const aWithoutSpace = a.value.toString().replace(/\s/g, "");
                              const bWithoutSpace = b.value.toString().replace(/\s/g, "");
                              const idA = ResourcesIds[aWithoutSpace as keyof typeof ResourcesIds];
                              const idB = ResourcesIds[bWithoutSpace as keyof typeof ResourcesIds];
                              const rarityA = (idA !== undefined ? RESOURCE_RARITY[idA] : undefined) || Infinity;
                              const rarityB = (idB !== undefined ? RESOURCE_RARITY[idB] : undefined) || Infinity;
                              return rarityA - rarityB;
                            },
                          )
                          .map((attribute, index: any) => (
                            <ResourceIcon
                              resource={attribute.value as string}
                              size="sm"
                              key={`${attribute.trait_type}-${index}`}
                            />
                          ))}
                      </div>
                      <span className="text-lg">{price.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total and Purchase Button */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-medium">Total:</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">{totalPrice.toLocaleString()}</span>
                <ResourceIcon resource="Lords" size="sm" />
              </div>
            </div>
            {!address ? (
              <ConnectWalletPrompt connectors={connectors} connect={connect} />
            ) : (
              <Button className="w-full" onClick={handlePurchase} disabled={selectedPasses.length === 0}>
                Purchase {selectedPasses.length} Pass{selectedPasses.length !== 1 ? "es" : ""}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
