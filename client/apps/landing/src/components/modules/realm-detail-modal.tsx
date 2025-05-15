import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { seasonPassAddress } from "@/config";
import { fetchActiveMarketOrders } from "@/hooks/services";
import { useLords } from "@/hooks/use-lords";
import { useMarketplace } from "@/hooks/use-marketplace";
import { MergedNftData } from "@/types";
import { shortenHex } from "@dojoengine/utils";
import { useAccount, useConnect } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatUnits } from "viem";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

// Marketplace fee percentage
const MARKETPLACE_FEE_PERCENT = 5;

// Define the props for the modal component
interface RealmDetailModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  realmData: MergedNftData;
  isOwner: boolean;
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
  marketplaceActions,
  isListed,
  price,
  orderId,
  collection_id,
  expiration, // Added
}: RealmDetailModalProps) => {
  const { name, image, attributes } = realmData.metadata ?? {};
  const {
    listItem,
    cancelOrder,
    editOrder,
    acceptOrders,
    isLoading,
    approveMarketplace,
    seasonPassApproved,
    isApprovingMarketplace,
  } = marketplaceActions;

  const { data: activeMarketOrder } = useQuery({
    queryKey: ["activeMarketOrdersTotal", seasonPassAddress, realmData.token_id.toString()],
    queryFn: () => fetchActiveMarketOrders(seasonPassAddress, realmData.token_id.toString()),
    refetchInterval: 30_000,
    enabled: isOpen,
  });

  // Get wallet state
  const { address } = useAccount();
  const { connectors, connect } = useConnect();

  const { lordsBalance } = useLords();

  const userBalance = lordsBalance ?? BigInt(0);
  const nftPrice = price ?? BigInt(0);
  const hasSufficientBalance = userBalance >= nftPrice;

  // State for inputs
  const durationOptions = {
    "12hr": 60 * 60 * 12, // 12 hours
    "24hr": 60 * 60 * 24 + 60 * 2, // 24 hours + 2 minutes
    "3days": 60 * 60 * 24 * 3, // 3 days
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
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  // Calculate time remaining for auctions about to expire
  useEffect(() => {
    if (!expiration) return;

    const expirationTime = Number(expiration) * 1000;
    const updateCountdown = () => {
      const now = Date.now();
      const diff = expirationTime - now;

      if (diff <= 0) {
        setTimeRemaining("Expired");
        return;
      }

      // Only show countdown if less than an hour remains
      if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeRemaining(`${minutes}m ${seconds}s remaining`);
      } else {
        setTimeRemaining(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiration]);

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
    if (/*!contractAddress || */ !listPrice) return; // Basic validation
    const priceInWei = BigInt(parseFloat(listPrice) * 1e18); // Convert price to wei (assuming 18 decimals for LORDS)

    try {
      await listItem({
        token_id: parseInt(realmData.token_id.toString()), // Convert to string to match expected type
        collection_id, // Placeholder: Use actual collection ID if available/needed
        price: priceInWei,
        expiration: listExpiration,
        cancel_order_id: activeMarketOrder?.[0]?.order_id,
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
    if (!orderId && !activeMarketOrder?.[0]?.order_id) return; // Basic validation
    try {
      await cancelOrder({
        order_id: BigInt(orderId ?? activeMarketOrder?.[0]?.order_id ?? 0),
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
      await acceptOrders({
        order_ids: [BigInt(orderId)],
        totalPrice: price,
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
          <DialogTitle>Season 1 Pass</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <img src={image} alt={name ?? "Realm"} className="rounded-md w-72 object-contain mx-auto" />
            <div className="flex flex-col gap-5">
              <div className=" leading-none tracking-tight items-center gap-2">
                <h3 className="text-gold font-semibold text-2xl">{name || "N/A"}</h3>
                <p className="text-muted-foreground">#{parseInt(realmData.token_id?.toString())}</p>
              </div>
              {/* Display Resources */}
              <div>
                <Label className="uppercase tracking-wider mb-1 flex justify-between items-center text-muted-foreground text-xs">
                  Resources
                </Label>
                <div className="flex flex-wrap gap-2">
                  {attributes
                    ?.filter((attribute) => attribute.trait_type === "Resource")
                    .map((attribute, index) => (
                      <ResourceIcon
                        resource={attribute.value as string}
                        size="lg"
                        key={`${attribute.trait_type}-${index}`}
                      />
                    ))}
                </div>
              </div>
              {/* Display Wonder */}
              {attributes?.find((attribute) => attribute.trait_type === "Wonder")?.value && (
                <div className="border-t items-center flex uppercase flex-wrap w-full py-2 justify-center text-center text-sm bg-crimson/50 rounded-lg">
                  Wonder:{" "}
                  <span className="text-gold font-bold tracking-wide">
                    {attributes.find((attribute) => attribute.trait_type === "Wonder")?.value}
                  </span>
                </div>
              )}
              <div>
                <Label className="uppercase tracking-wider mb-1 flex justify-between items-center text-muted-foreground text-xs">
                  Owned By
                </Label>
                <span>{shortenHex(realmData.token_owner ?? "", 10)}</span>
              </div>
            </div>
          </div>
          {/* Display Price if Listed */}
          {isListed && price !== undefined ? (
            <div className="border-t pt-6 px-4">
              <p className="text-sm text-muted-foreground uppercase tracking-wider">Price</p>
              <div className="flex items-center gap-2">
                <div className="text-3xl font-bold text-gold -mt-2">
                  {isSyncing
                    ? "Syncing..."
                    : parseFloat(formatUnits(price, 18)).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                </div>
                <ResourceIcon resource="Lords" size="sm" />
                <div className="text-sm text-muted-foreground">
                  {timeRemaining ? (
                    <span className="text-red-500 font-medium">{timeRemaining}</span>
                  ) : (
                    `Expires ${new Date(Number(expiration) * 1000).toLocaleString()}`
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Includes {MARKETPLACE_FEE_PERCENT}% marketplace fee</p>
            </div>
          ) : (
            <div className="text-center border-t pt-3 mt-3">
              <p className="text-sm text-muted-foreground uppercase tracking-wider">Price</p>
              <p className="text-2xl font-bold text-gold">Not Listed</p>
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
                                Back
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
                          <div className="flex flex-col gap-2 p-3 bg-background/50">
                            <div className="grid grid-cols-6 gap-2 border-b pb-2 text-xs font-semibold text-muted-foreground">
                              <div className="col-span-2">Item</div>
                              <div>Floor</div>
                              <div>Fee</div>
                              <div className="justify-self-end col-span-2">List Price</div>
                            </div>
                            <div className="grid grid-cols-6 gap-2 items-center py-2 ">
                              <div className="flex items-center gap-2 col-span-2">
                                <img src={image} alt={name ?? "Realm"} className="w-8 h-8 rounded" />
                                <span className="truncate max-w-[80px]">{name}</span>
                              </div>
                              <div className="text-sm">{/* Floor price here, e.g. */}-</div>
                              <div className="text-xs">
                                {listPrice && parseFloat(listPrice) > 0
                                  ? ((parseFloat(listPrice) * MARKETPLACE_FEE_PERCENT) / 100).toLocaleString("en-US", {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    })
                                  : "--"}
                                <span className="ml-1">LORDS</span>
                              </div>
                              <div className="justify-self-end relative col-span-2">
                                <Input
                                  id="list-price"
                                  value={listPrice}
                                  onChange={(e) => setListPrice(e.target.value)}
                                  placeholder="0"
                                  disabled={isLoading || isSyncing}
                                  className="w-full max-w-36"
                                />
                                <span className="absolute text-xs right-1.5 top-2.5">LORDS</span>
                              </div>
                            </div>
                            {/* Proceeds below the table */}
                            <div className=" mb-1 flex justify-between border-t py-3 font-semibold">
                              <span>You receive: </span>
                              <div>
                                {listPrice
                                  ? parseFloat(listPrice) > 0 &&
                                    ((parseFloat(listPrice) * (100 - MARKETPLACE_FEE_PERCENT)) / 100).toLocaleString(
                                      "en-US",
                                      {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 2,
                                      },
                                    )
                                  : 0}
                                <span className="ml-3">LORDS</span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div>
                              {" "}
                              <div className="flex items-center gap-2 w-full justify-end">
                                <span className="text-sm font-medium text-muted-foreground ml-2">
                                  Expires: {new Date(listExpiration * 1000).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between mt-1">
                                <Button
                                  variant="outline"
                                  onClick={() => setShowListInputs(false)}
                                  size="sm"
                                  disabled={isLoading || isSyncing}
                                >
                                  <ArrowLeft /> Back
                                </Button>
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={selectedDuration}
                                    disabled={isLoading || isSyncing}
                                    onValueChange={handleDurationChange}
                                  >
                                    <SelectTrigger className="w-[140px]">
                                      <SelectValue placeholder={"Expiration"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="12hr">12 hours</SelectItem>
                                      <SelectItem value="24hr">24 hours</SelectItem>
                                      <SelectItem value="3days">3 days</SelectItem>
                                      <SelectItem value="7days">7 days</SelectItem>
                                      <SelectItem value="30days">30 days</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    onClick={handleListItem}
                                    disabled={
                                      isLoading || isSyncing || !listPrice || marketplaceActions.isCreatingOrder
                                    }
                                  >
                                    {marketplaceActions.isCreatingOrder
                                      ? "Listing..."
                                      : !listPrice
                                        ? "Set price"
                                        : "Confirm Listing"}
                                  </Button>
                                </div>
                              </div>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
