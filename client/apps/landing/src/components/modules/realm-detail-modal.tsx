import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { lordsAddress } from "@/config";
import { useMarketplace } from "@/hooks/use-marketplace";
import { RealmMetadata } from "@/types";
import { useAccount, useBalance, useConnect } from "@starknet-react/core";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatUnits } from "viem";
import { ResourceIcon } from "../ui/elements/resource-icon";

// Marketplace fee percentage
const MARKETPLACE_FEE_PERCENT = 5;

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
  expiration?: number; // Added: Expiration timestamp (seconds)
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
  expiration, // Added
}: RealmDetailModalProps) => {
  const { name, tokenId, contractAddress, imageSrc, attributes } = realmData;
  const {
    listItem,
    cancelOrder,
    editOrder,
    acceptOrder,
    isLoading,
    approveMarketplace,
    seasonPassApproved,
    isApprovingMarketplace,
  } = marketplaceActions;

  // Get wallet state
  const { address } = useAccount();
  const { connectors, connect } = useConnect();

  // Fetch user's LORDS balance
  const { data: balanceData } = useBalance({
    address: address,
    token: lordsAddress as `0x${string}`,
    watch: true,
  });
  const userBalance = balanceData?.value ?? BigInt(0);
  const nftPrice = price ?? BigInt(0);
  const hasSufficientBalance = userBalance >= nftPrice;

  // State for inputs
  const durationOptions = {
    "24hr": 60 * 60 * 24 + 60 * 2, // 24hours + 2 minutes
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

      setIsSyncing(true);

      setShowListInputs(false);
    } catch (error) {
      console.error("Failed to list item:", error);
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

      setIsSyncing(true);

      setShowEditInputs(false);
    } catch (error) {
      console.error("Failed to edit order:", error);
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
              <div className="text-4xl font-bold text-gold gap-2 mx-auto text-center flex items-center justify-center">
                <div>
                  {isSyncing
                    ? "Syncing..."
                    : parseFloat(formatUnits(price, 18)).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                </div>

                <ResourceIcon resource="Lords" size="sm" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Includes {MARKETPLACE_FEE_PERCENT}% marketplace fee</p>
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
                  <Button onClick={approveMarketplace} disabled={isApprovingMarketplace} size="lg">
                    {isApprovingMarketplace ? "Approving..." : "Approve Marketplace"}
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
                            <Label htmlFor="edit-price">
                              New Price (LORDS) <ResourceIcon resource="Lords" size="sm" />
                            </Label>
                            {editPrice && parseFloat(editPrice) > 0 && (
                              <div className="text-sm text-muted-foreground mb-1 flex justify-between">
                                <span>
                                  You receive:{" "}
                                  {((parseFloat(editPrice) * (100 - MARKETPLACE_FEE_PERCENT)) / 100).toLocaleString(
                                    "en-US",
                                    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                                  )}{" "}
                                  LORDS
                                </span>
                                <span>
                                  Fee:{" "}
                                  {((parseFloat(editPrice) * MARKETPLACE_FEE_PERCENT) / 100).toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  LORDS ({MARKETPLACE_FEE_PERCENT}%)
                                </span>
                              </div>
                            )}
                            <Input
                              id="edit-price"
                              type="number"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              placeholder="e.g., 1500"
                              disabled={isLoading || isSyncing}
                            />
                            {expiration && ( // Display expiration if available
                              <div className="text-sm font-medium text-muted-foreground mt-1">
                                Current Expiration: {new Date(expiration * 1000).toLocaleString()}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              To change the expiration time, please cancel this listing and create a new one.
                            </p>
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
                          <Button
                            variant="cta"
                            onClick={() => setShowListInputs(true)}
                            size="lg"
                            disabled={isLoading || isSyncing}
                          >
                            List Item
                          </Button>
                        ) : (
                          <div className="flex flex-col gap-2 border p-3 rounded-md bg-background/50">
                            <Label htmlFor="list-price" className="flex items-center gap-2">
                              Price (LORDS) <ResourceIcon resource="Lords" size="sm" />
                            </Label>
                            {listPrice && parseFloat(listPrice) > 0 && (
                              <div className="text-sm text-muted-foreground mb-1 flex justify-between">
                                <span>
                                  You receive:{" "}
                                  {((parseFloat(listPrice) * (100 - MARKETPLACE_FEE_PERCENT)) / 100).toLocaleString(
                                    "en-US",
                                    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                                  )}{" "}
                                  LORDS
                                </span>
                                <span>
                                  Fee:{" "}
                                  {((parseFloat(listPrice) * MARKETPLACE_FEE_PERCENT) / 100).toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  LORDS ({MARKETPLACE_FEE_PERCENT}%)
                                </span>
                              </div>
                            )}
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
                            <div className="text-sm font-medium text-muted-foreground mt-1">
                              Expires: {new Date(listExpiration * 1000).toLocaleString()}
                            </div>
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
                {isListed && price !== undefined ? (
                  <>
                    {address ? (
                      <div className="flex flex-col items-center sm:items-stretch">
                        {/* Insufficient Balance Message - Showing Current Balance */}
                        {address &&
                          !hasSufficientBalance &&
                          expiration !== undefined &&
                          expiration * 1000 >= Date.now() && (
                            <div className="flex items-center justify-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md p-2 mb-2">
                              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                              <span>
                                Insufficient LORDS balance (Balance:{" "}
                                {parseFloat(formatUnits(userBalance, 18)).toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                                )
                              </span>
                            </div>
                          )}
                        <Button
                          onClick={handleAcceptOrder}
                          size="lg"
                          variant="cta"
                          disabled={
                            isLoading ||
                            isSyncing ||
                            hasSeasonPassMinted ||
                            marketplaceActions.isAcceptingOrder ||
                            (expiration !== undefined && expiration * 1000 < Date.now())
                          }
                          className="w-full sm:w-auto"
                        >
                          {expiration !== undefined && expiration * 1000 < Date.now()
                            ? "Listing Expired"
                            : marketplaceActions.isAcceptingOrder
                              ? "Purchasing..."
                              : `Purchase`}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 items-center">
                        <p className="text-sm text-muted-foreground mb-2">Connect wallet to purchase</p>
                        {connectors.map((connector) => (
                          <Button
                            key={connector.id}
                            onClick={() => connect({ connector })}
                            variant="default"
                            size="sm"
                            className="w-full flex items-center justify-center gap-2"
                          >
                            {connector.icon && typeof connector.icon === "string" && (
                              <img src={connector.icon} alt={`${connector.name} icon`} className="w-5 h-5" />
                            )}
                            {connector.icon &&
                              typeof connector.icon !== "string" &&
                              connector.id !== "argentX" &&
                              connector.id !== "braavos" && (
                                <span className="w-5 h-5 flex items-center justify-center">
                                  {connector.icon.light ?? connector.icon}
                                </span>
                              )}
                            Connect {connector.name}
                          </Button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>{/* Optionally add a message like "Not available for purchase" */}</>
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
            {/* Close Button - Conditionally render */}
            {address && ( // Only show Close button if connected or owner
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                size="sm"
                className="self-end"
                disabled={isLoading}
              >
                Close
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
