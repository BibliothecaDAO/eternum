import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMarketplace } from "@/hooks/use-marketplace";
import { RealmMetadata } from "@/types";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatUnits } from "viem";
import { ResourceIcon } from "../ui/elements/resource-icon";

// Define the structure for realm data passed to the modal
interface RealmModalData {
  tokenId: string; // Pass as string
  contractAddress?: string;
  name?: string | null;
  imageSrc: string;
  attributes?: RealmMetadata["attributes"];
  // Add any other details needed in the modal
}

// Define the props for the modal component
interface RealmDetailModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  realmData: RealmModalData;
  isOwner: boolean;
  hasSeasonPassMinted: boolean;
  marketplaceActions: ReturnType<typeof useMarketplace>;
  // Listing details passed from RealmCard
  isListed: boolean;
  collection_id: number;
  price?: bigint;
  orderId?: string;
}

export const RealmDetailModal = ({
  isOpen,
  onOpenChange,
  realmData,
  isOwner,
  hasSeasonPassMinted,
  marketplaceActions,
  isListed,
  price,
  orderId,
  collection_id,
}: RealmDetailModalProps) => {
  const { name, tokenId, contractAddress, imageSrc, attributes } = realmData;
  const { listItem, cancelOrder, editOrder, acceptOrder, isLoading, approveMarketplace, seasonPassApproved } =
    marketplaceActions;

  // State for inputs
  const durationOptions = {
    "1hr": 60 * 60,
    "6hr": 60 * 60 * 6,
    "24hr": 60 * 60 * 24,
    "7days": 60 * 60 * 24 * 7,
    "30days": 60 * 60 * 24 * 30,
  };
  type DurationKey = keyof typeof durationOptions;

  const calculateExpirationTimestamp = (durationKey: DurationKey): number => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return nowInSeconds + durationOptions[durationKey];
  };

  const [showListInputs, setShowListInputs] = useState(false);
  const [listPrice, setListPrice] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<DurationKey>("7days");
  const [listExpiration, setListExpiration] = useState<number>(() => calculateExpirationTimestamp("7days"));

  const [showEditInputs, setShowEditInputs] = useState(false);
  const [editPrice, setEditPrice] = useState(price ? formatUnits(price, 18) : ""); // Assuming price is u128, format from wei
  const [isSyncing, setIsSyncing] = useState(false);

  // Reset inputs AND syncing state when modal closes or relevant props change
  useEffect(() => {
    setShowListInputs(false);
    setShowEditInputs(false);
    setListPrice("");
    setEditPrice(price ? formatUnits(price, 18) : "");
    setSelectedDuration("7days");
    setListExpiration(calculateExpirationTimestamp("7days"));
    if (!isOpen) {
      setIsSyncing(false);
    }
  }, [isOpen, price]);

  // Effect to detect when indexer data has updated props
  useEffect(() => {
    if (isSyncing) {
      setIsSyncing(false);
    }
  }, [isListed, price, orderId, isOwner, isSyncing]);

  // Handler for duration change
  const handleDurationChange = (value: string) => {
    const durationKey = value as DurationKey;
    setSelectedDuration(durationKey);
    setListExpiration(calculateExpirationTimestamp(durationKey));
  };

  // --- Action Handlers ---
  const handleListItem = async () => {
    if (!contractAddress || !listPrice) return; // Basic validation
    const priceInWei = BigInt(parseFloat(listPrice) * 1e18); // Convert price to wei (assuming 18 decimals for LORDS)

    try {
      await listItem({
        token_id: parseInt(tokenId), // Ensure tokenId is number if required by hook
        collection_id, // Placeholder: Use actual collection ID if available/needed
        price: priceInWei,
        expiration: listExpiration,
      });
      toast.success("Transaction confirmed! Syncing listing status...");
      setIsSyncing(true);

      setShowListInputs(false);
    } catch (error) {
      console.error("Failed to list item:", error);
      toast.error("Failed to create listing. Please try again.");
      setIsSyncing(false);
    }
  };

  const handleEditOrder = async () => {
    if (!orderId || !editPrice) return; // Basic validation
    const priceInWei = BigInt(parseFloat(editPrice) * 1e18); // Convert price to wei

    try {
      await editOrder({
        order_id: BigInt(orderId),
        new_price: priceInWei,
      });
      toast.success("Transaction confirmed! Syncing listing update...");
      setIsSyncing(true);

      setShowEditInputs(false);
    } catch (error) {
      console.error("Failed to edit order:", error);
      toast.error("Failed to update listing. Please try again.");
      setIsSyncing(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!orderId) return; // Basic validation
    try {
      await cancelOrder({
        order_id: BigInt(orderId),
      });
      toast.success("Transaction confirmed! Syncing cancellation...");
      setIsSyncing(true);
    } catch (error) {
      console.error("Failed to cancel order:", error);
      toast.error("Failed to cancel listing. Please try again.");
      setIsSyncing(false);
    }
  };

  const handleAcceptOrder = async () => {
    if (!orderId || price === undefined) return; // Validate both orderId and price exist
    try {
      await acceptOrder({
        order_id: BigInt(orderId),
        price: price,
      });

      setIsSyncing(true);
    } catch (error) {
      console.error("Failed to accept order:", error);
      toast.error("Failed to purchase realm. Please try again.");
      setIsSyncing(false);
    }
  };

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
          <img src={imageSrc} alt={name ?? "Realm"} className="rounded-md w-72 mb-4 object-contain mx-auto" />

          {/* Display Price if Listed */}
          {isListed && price !== undefined ? (
            <div className="text-center border-t border-b py-3 my-3">
              <p className="text-sm text-muted-foreground uppercase tracking-wider">Price</p>
              <p className="text-2xl font-bold text-gold">{isSyncing ? "Syncing..." : formatUnits(price, 18)} LORDS</p>
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
        <DialogFooter className="flex-col sm:flex-row sm:justify-between items-stretch pt-4 border-t">
          <div className="flex-grow flex flex-col gap-2 order-2 sm:order-1 mb-4 sm:mb-0">
            {/* Syncing Indicator */}
            {isSyncing && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Syncing status...
              </div>
            )}
            {/* --- Owner/Non-Owner Logic --- */}
            {isOwner ? (
              // --- Owner Logic ---
              <>
                {!seasonPassApproved ? (
                  // --- Owner & Needs Approval ---
                  <Button onClick={approveMarketplace} disabled={isLoading || isSyncing} size="sm">
                    {isLoading ? "Approving..." : "Approve Marketplace"}
                  </Button>
                ) : (
                  // --- Owner & Approved: Show Actions ---
                  <>
                    {isListed && orderId ? (
                      <>
                        {" "}
                        {/* Owner & Listed & Approved */}
                        {!showEditInputs ? (
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => setShowEditInputs(true)}
                              size="sm"
                              disabled={isLoading || isSyncing}
                            >
                              Edit Listing
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={handleCancelOrder}
                              size="sm"
                              disabled={isLoading || isSyncing || marketplaceActions.isCancellingOrder}
                            >
                              {marketplaceActions.isCancellingOrder ? "Cancelling..." : "Cancel Listing"}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 border p-3 rounded-md bg-background/50">
                            <Label htmlFor="edit-price">New Price (LORDS)</Label>
                            <Input
                              id="edit-price"
                              type="number"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              placeholder="e.g., 1500"
                              disabled={isLoading || isSyncing}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <Button
                                variant="outline"
                                onClick={() => setShowEditInputs(false)}
                                size="sm"
                                disabled={isLoading || isSyncing}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleEditOrder}
                                size="sm"
                                disabled={isLoading || isSyncing || !editPrice || marketplaceActions.isEditingOrder}
                              >
                                {marketplaceActions.isEditingOrder ? "Saving..." : "Save Changes"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {" "}
                        {/* Owner & Not Listed & Approved */}
                        {!showListInputs ? (
                          <Button onClick={() => setShowListInputs(true)} size="sm" disabled={isLoading || isSyncing}>
                            List Item
                          </Button>
                        ) : (
                          <div className="flex flex-col gap-2 border p-3 rounded-md bg-background/50">
                            <Label htmlFor="list-price">Price (LORDS)</Label>
                            <Input
                              id="list-price"
                              type="number"
                              value={listPrice}
                              onChange={(e) => setListPrice(e.target.value)}
                              placeholder="e.g., 1000"
                              disabled={isLoading || isSyncing}
                            />
                            <Label htmlFor="list-expiration" className="mt-2">
                              Expiration
                            </Label>
                            <RadioGroup
                              id="list-expiration"
                              value={selectedDuration}
                              onValueChange={handleDurationChange}
                              className="flex flex-wrap gap-x-4 gap-y-2"
                              disabled={isLoading || isSyncing}
                            >
                              {Object.keys(durationOptions).map((key) => (
                                <div key={key} className="flex items-center space-x-2">
                                  <RadioGroupItem value={key} id={`duration-${key}`} />
                                  <Label htmlFor={`duration-${key}`} className="font-normal cursor-pointer">
                                    {key}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                            <div className="flex justify-end gap-2 mt-2">
                              <Button
                                variant="outline"
                                onClick={() => setShowListInputs(false)}
                                size="sm"
                                disabled={isLoading || isSyncing}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleListItem}
                                size="sm"
                                disabled={isLoading || isSyncing || !listPrice || marketplaceActions.isCreatingOrder}
                              >
                                {marketplaceActions.isCreatingOrder ? "Listing..." : "Confirm Listing"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              // --- Non-Owner Logic ---
              <>
                {isListed && price !== undefined && (
                  <Button
                    onClick={handleAcceptOrder}
                    size="sm"
                    disabled={isLoading || isSyncing || hasSeasonPassMinted || marketplaceActions.isAcceptingOrder}
                    className="w-full sm:w-auto"
                  >
                    {marketplaceActions.isAcceptingOrder
                      ? "Purchasing..."
                      : `Purchase for ${formatUnits(price, 18)} LORDS`}
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="order-1 sm:order-2 flex flex-col items-end">
            {/* Status Text */}
            {hasSeasonPassMinted && (
              <p className="text-muted-foreground text-center sm:text-right mb-2 text-xs">
                Season Pass already minted.
              </p>
            )}
            {/* Close Button - Moved slightly for better alignment */}
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              size="sm"
              className="self-end"
              disabled={isLoading}
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
