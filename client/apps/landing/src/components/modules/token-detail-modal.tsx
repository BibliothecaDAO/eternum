import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { marketplaceCollections, realmsAddress, seasonPassAddress } from "@/config";
import { fetchActiveMarketOrders } from "@/hooks/services";
import { useLords } from "@/hooks/use-lords";
import { useMarketplace } from "@/hooks/use-marketplace";
import { formatRelativeTime } from "@/lib/utils";
import { MergedNftData } from "@/types";
import { shortenHex } from "@dojoengine/utils";
import { useAccount, useConnect } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Copy, ImageOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatUnits } from "viem";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { Separator } from "../ui/separator";
import { CreateListingsDrawer } from "./marketplace-create-listings-drawer";
import { EditListingDrawer } from "./marketplace-edit-listing-drawer";
import { CollectionType } from "./token-card";

// Marketplace fee percentage
const MARKETPLACE_FEE_PERCENT = 5;

// Timer component for auction countdown
interface TimerProps {
  expiration?: number;
}

const Timer = ({ expiration }: TimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

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

  if (timeRemaining) {
    return <span className="text-red-500 font-medium">{timeRemaining}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={0} defaultOpen={false} disableHoverableContent>
        <TooltipTrigger asChild>
          <span>Expires {formatRelativeTime(expiration)}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{new Date(Number(expiration) * 1000).toLocaleString()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Define the props for the modal component
interface TokenDetailModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  tokenData: MergedNftData;
  isOwner: boolean;
  collectionType: CollectionType;
  marketplaceActions: ReturnType<typeof useMarketplace>;
  // Listing details passed from RealmCard
  isListed: boolean;
  price?: bigint;
  orderId?: string;
  expiration?: number; // Added: Expiration timestamp (seconds)
  displayName: string; // Added: Display name passed from parent
}

export const TokenDetailModal = ({
  isOpen,
  onOpenChange,
  tokenData,
  isOwner,
  collectionType,
  marketplaceActions,
  isListed,
  price,
  orderId,
  expiration, // Added
  displayName, // Added
}: TokenDetailModalProps) => {
  const { attributes, name, image: originalImage } = tokenData.metadata ?? {};

  // Transform IPFS URLs to use Pinata gateway
  const image = originalImage?.startsWith("ipfs://")
    ? originalImage.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")
    : originalImage;
  const { cancelOrder, acceptOrders, isLoading } = marketplaceActions;

  const { data: activeMarketOrder } = useQuery({
    queryKey: ["activeMarketOrdersTotal", seasonPassAddress, tokenData.token_id.toString()],
    queryFn: () => fetchActiveMarketOrders(seasonPassAddress, [tokenData.token_id.toString()]),
    refetchInterval: 30_000,
    enabled: isOpen,
  });

  console.log("[TokenDetailModal] tokenData", tokenData);

  // Get wallet state
  const { address } = useAccount();
  const { connector, connectors, connect } = useConnect();

  const { lordsBalance } = useLords();

  const userBalance = lordsBalance ?? BigInt(0);
  const nftPrice = price ?? BigInt(0);
  const hasSufficientBalance = userBalance >= nftPrice;

  const [isSyncing, setIsSyncing] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Effect to detect when indexer data has updated props
  useEffect(() => {
    if (isSyncing) {
      setIsSyncing(false);
    }
  }, [isListed, price, orderId, isOwner, isSyncing]);

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

  // Determine ownership validity: current owner must match lister
  const normalizedCurrentOwner = tokenData.token_owner ? String(tokenData.token_owner).toLowerCase() : undefined;
  const normalizedOrderOwner = tokenData.order_owner ? String(tokenData.order_owner).toLowerCase() : undefined;
  const ownershipInvalid = Boolean(
    isListed && normalizedCurrentOwner && normalizedOrderOwner && normalizedCurrentOwner !== normalizedOrderOwner,
  );

  const renderPriceSection = () => {
    if (!isListed || price === undefined) {
      return (
        <>
          <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Price</p>

          <p className="text-2xl font-bold text-gold">Not Listed</p>
        </>
      );
    }

    return (
      <>
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
            <Timer expiration={expiration} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Includes {MARKETPLACE_FEE_PERCENT}% marketplace fee</p>
      </>
    );
  };

  const renderOwnerActions = () => (
    <>
      {isListed && orderId ? (
        <div className="flex gap-2 mt-2">
          <EditListingDrawer
            image={image ?? ""}
            name={name ?? ""}
            price={price ?? BigInt(0)}
            orderId={orderId}
            isLoading={isLoading}
            isSyncing={isSyncing}
            expiration={expiration ?? null}
            marketplaceActions={marketplaceActions}
          />
          <Button
            variant="outline"
            onClick={handleCancelOrder}
            size="sm"
            className="border-destructive text-destructive"
            disabled={isLoading || isSyncing || marketplaceActions.isCancellingOrder}
          >
            {marketplaceActions.isCancellingOrder ? "Cancelling..." : "Cancel Listing"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-2">
          <CreateListingsDrawer
            isLoading={isLoading}
            isSyncing={isSyncing}
            tokens={[tokenData]}
            marketplaceActions={marketplaceActions}
          />
        </div>
      )}
    </>
  );

  const renderBuyerActions = () => {
    if (!address) {
      return (
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
      );
    }

    const isExpired = expiration !== undefined && expiration * 1000 < Date.now();
    const showInsufficientBalance =
      address && !hasSufficientBalance && expiration !== undefined && expiration * 1000 >= Date.now();

    return (
      <div className="flex flex-col items-center sm:items-stretch mt-2">
        {ownershipInvalid && (
          <div className="flex items-center justify-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md p-2 mb-2">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span>
              This listing is no longer valid because the token has been transferred to a different owner. Purchase is
              disabled.
            </span>
          </div>
        )}
        {showInsufficientBalance && (
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
          disabled={isLoading || isSyncing || marketplaceActions.isAcceptingOrder || isExpired || ownershipInvalid}
          className="w-full sm:w-auto"
        >
          {isExpired
            ? "Listing Expired"
            : ownershipInvalid
              ? "Purchase Disabled"
              : marketplaceActions.isAcceptingOrder
                ? "Purchasing..."
                : "Buy Now"}
        </Button>
      </div>
    );
  };

  return (
    <>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-2xl md:max-w-6xl bg-card border-border text-foreground max-h-[100vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-center">
                  {image && !imageError ? (
                    <img
                      src={image}
                      alt={name ?? "Realm"}
                      className="rounded-md object-contain"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-full aspect-square bg-slate-800 rounded-md flex items-center justify-center">
                      <ImageOff className="w-24 h-24" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-gold font-semibold text-3xl">{displayName}</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const collectionKey = Object.entries(marketplaceCollections).find(
                            ([_, config]) => config.address === tokenData.contract_address,
                          )?.[0];

                          if (collectionKey) {
                            const shareUrl = `${window.location.origin}/trade/${collectionKey}/${tokenData.token_id}`;
                            navigator.clipboard.writeText(shareUrl);
                            toast.success("Link copied to clipboard!");
                          } else {
                            toast.error("Unable to create share link");
                          }
                        }}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Copy className="h-4 w-4" />
                        Share Token
                      </Button>
                    </div>
                    <div className="flex items-center gap-2  ">
                      <div className="flex items-center gap-2">{tokenData.name}</div>
                      <Separator orientation="vertical" className="h-4" />
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">Owned By</span>
                        {(() => {
                          const v = (tokenData as any)?.token_owner as unknown;
                          let addr = "";
                          if (typeof v === "string") {
                            addr = v;
                          } else if (typeof v === "number" || typeof v === "bigint") {
                            try {
                              addr = `0x${BigInt(v).toString(16)}`;
                            } catch {}
                          } else if (v != null) {
                            try {
                              addr = String(v);
                            } catch {}
                          }
                          return <span className="text-foreground">{addr ? shortenHex(addr, 10) : ""}</span>;
                        })()}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="w-fit">
                    <span>TOKEN #{parseInt(tokenData.token_id?.toString())}</span>
                  </Badge>
                  {/* Display Resources - Only for Realms collection */}
                  {tokenData.contract_address === realmsAddress && (
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
                  )}
                  {/* Display Wonder */}
                  {attributes?.find((attribute) => attribute.trait_type === "Wonder")?.value && (
                    <div className="border-t items-center flex uppercase flex-wrap w-full py-2 justify-center text-center text-sm bg-crimson/50 rounded-lg">
                      Wonder:{" "}
                      <span className="text-gold font-bold tracking-wide">
                        {attributes.find((attribute) => attribute.trait_type === "Wonder")?.value}
                      </span>
                    </div>
                  )}

                  {/* Display Price if Listed */}
                  <div className="border bg-card rounded-sm p-4">
                    {renderPriceSection()}
                    {isOwner ? renderOwnerActions() : isListed && price !== undefined && renderBuyerActions()}
                  </div>
                  {/* Display all attributes */}
                  {attributes && attributes.length > 0 && (
                    <div>
                      <Label className="uppercase tracking-wider mb-2 flex justify-between items-center text-muted-foreground text-xs">
                        All Attributes
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {attributes.map((attribute, index) => (
                          <Card key={`${attribute.trait_type}-${index}`} className="flex flex-col p-3">
                            <Label className="uppercase tracking-wider flex justify-between items-center text-muted-foreground text-xs mb-1">
                              {attribute.trait_type}
                            </Label>
                            <span className="text-sm font-medium">{attribute.value}</span>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row sm:justify-between items-stretch pt-4">
              <div className="flex-grow flex flex-col gap-2 order-2 sm:order-1 mb-4 sm:mb-0">
                {/* Syncing Indicator */}
                {isSyncing && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Syncing status...
                  </div>
                )}
                {/* --- Owner/Non-Owner Logic --- */}
                {isOwner && isListed && orderId && <>{/* Owner & Listed & Approved */}</>}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
