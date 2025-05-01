import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMarketplace } from "@/hooks/use-marketplace"; // Import the hook type if needed, or pass functions directly
import { RealmMetadata } from "@/types";
import { ResourceIcon } from "../ui/elements/resource-icon";

// Define the structure for realm data passed to the modal
interface RealmModalData {
  tokenId: string | number; // Use appropriate type based on source
  contractAddress?: string;
  name?: string | null;
  imageSrc: string;
  attributes?: RealmMetadata["attributes"];
  isListed?: boolean; // Added: Is the item currently listed?
  price?: string | number; // Added: Listing price (use appropriate type, e.g., string for formatted BigInt)
  // Add any other details needed in the modal
}

// Define the props for the modal component
interface RealmDetailModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  realmData: RealmModalData;
  isOwner: boolean;
  hasSeasonPassMinted: boolean;
  marketplaceActions: ReturnType<typeof useMarketplace>; // Pass the whole actions object
}

export const RealmDetailModal = ({
  isOpen,
  onOpenChange,
  realmData,
  isOwner,
  hasSeasonPassMinted,
  marketplaceActions,
}: RealmDetailModalProps) => {
  const { name, tokenId, contractAddress, imageSrc, attributes, isListed, price } = realmData;
  const { listItem, cancelOrder, editOrder, acceptOrder } = marketplaceActions;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle> {name || "N/A"}</DialogTitle>
          <div className="flex  justify-between gap-2 text-muted-foreground">
            <p>{parseInt(tokenId.toString())}</p>
            <p>
              {contractAddress?.slice(0, 4)}...{contractAddress?.slice(-4)}
            </p>
          </div>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <img src={imageSrc} alt={name ?? "Realm"} className="rounded-md mb-4 object-contain mx-auto" />

          {/* Display Price if Listed */}
          {isListed && price !== undefined ? (
            <div className="text-center border-t border-b py-3 my-3">
              <p className="text-sm text-muted-foreground uppercase tracking-wider">Price</p>
              {/* TODO: Format price appropriately (e.g., with ETH symbol) */}
              <p className="text-2xl font-bold text-gold">{price.toString()} ETH</p>
            </div>
          ) : (
            <div className="text-center border-t border-b py-3 my-3">
              <p className="text-sm text-muted-foreground uppercase tracking-wider">Price</p>
              <p className="text-2xl font-bold text-gold">Not for sale</p>
            </div>
          )}
          {/* Display Resources */}
          <div className="flex flex-wrap gap-2 mb-2 justify-center">
            {attributes
              ?.filter((attribute) => attribute.trait_type === "Resource")
              .map((attribute, index) => (
                <ResourceIcon resource={attribute.value as string} size="lg" key={`${attribute.trait_type}-${index}`} />
              ))}
          </div>
          {/* Display Wonder */}
          {attributes?.find((attribute) => attribute.trait_type === "Wonder")?.value && (
            <div className="border-t pt-2 mt-2 text-center text-sm uppercase">
              Wonder:{" "}
              <span className="text-gold font-bold tracking-wide">
                {attributes.find((attribute) => attribute.trait_type === "Wonder")?.value}
              </span>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row sm:justify-between items-center pt-4 border-t">
          <div className="flex gap-2 order-2 sm:order-1 mb-2 sm:mb-0">
            {/* Action Buttons Logic */}

            <>
              {isOwner && (
                <>
                  {isListed ? (
                    <>
                      {" "}
                      {/* Owner & Listed */}
                      <Button variant="secondary" onClick={editOrder} size="sm">
                        Edit Listing
                      </Button>
                      <Button variant="destructive" onClick={cancelOrder} size="sm">
                        Cancel Listing
                      </Button>
                    </>
                  ) : (
                    <>
                      {" "}
                      {/* Owner & Not Listed */}
                      <Button onClick={listItem} size="sm">
                        List Item
                      </Button>
                    </>
                  )}
                </>
              )}
              {!isOwner && isListed && (
                <>
                  {" "}
                  {/* Non-Owner & Listed */}
                  {/* TODO: Disable button if loading/error, add price context */}
                  <Button onClick={acceptOrder} size="sm">
                    Purchase
                  </Button>
                </>
              )}
              {/* Implicit: Non-Owner & Not Listed = No purchase button */}
            </>
          </div>
          <div className="order-1 sm:order-2 flex flex-col items-end">
            {/* Status/Close */}
            {hasSeasonPassMinted && (
              <p className="text-muted-foreground text-center sm:text-right mb-2">Season Pass already minted.</p>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
