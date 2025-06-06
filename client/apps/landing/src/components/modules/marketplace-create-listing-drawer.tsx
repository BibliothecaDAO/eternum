import { fetchActiveMarketOrders } from "@/hooks/services";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useMarketplaceApproval } from "@/hooks/use-marketplace-approval";
import { MergedNftData } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import React, { useState } from "react";
import { Button } from "../ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../ui/drawer";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

// Marketplace fee percentage
const MARKETPLACE_FEE_PERCENT = 2.5;

interface CreateListingDrawerProps {
  tokens: MergedNftData[];
  collection_id: number; // Refactor for multiple collections
  image: string;
  name: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  marketplaceActions: ReturnType<typeof useMarketplace>;
}

// State for inputs
const durationOptions = {
  "12hr": 60 * 60 * 12, // 12 hours
  "24hr": 60 * 60 * 24 + 60 * 2, // 24 hours + 2 minutes
  "3days": 60 * 60 * 24 * 3, // 3 days
  "7days": 60 * 60 * 24 * 7,
  "30days": 60 * 60 * 24 * 30,
};
type DurationKey = keyof typeof durationOptions;

export const CreateListingDrawer: React.FC<CreateListingDrawerProps> = ({
  image,
  name,
  tokens,
  collection_id,
  isLoading,
  isSyncing,
  marketplaceActions,
}) => {
  const [open, setOpen] = useState(false);

  const { collectionApprovedForMarketplace, isApprovingMarketplace, handleApproveMarketplace } = useMarketplaceApproval(
    tokens[0].contract_address,
  );

  const calculateExpirationTimestamp = (durationKey: DurationKey): number => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return nowInSeconds + durationOptions[durationKey];
  };

  const [listPrice, setListPrice] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<DurationKey>("7days");
  const [listExpiration, setListExpiration] = useState<number>(() => calculateExpirationTimestamp("7days"));

  // Handler for duration change
  const handleDurationChange = (value: string) => {
    const durationKey = value as DurationKey;
    setSelectedDuration(durationKey);
    setListExpiration(calculateExpirationTimestamp(durationKey));
  };

  const { data: activeMarketOrder } = useQuery({
    queryKey: ["activeMarketOrders", tokens[0].contract_address, tokens[0].token_id.toString()],
    queryFn: () => fetchActiveMarketOrders(tokens[0].contract_address, tokens[0].token_id.toString()),
    refetchInterval: 30_000,
  });

  // --- Action Handlers ---
  const handleListItem = async () => {
    if (/*!contractAddress || */ !listPrice) return; // Basic validation
    const priceInWei = BigInt(parseFloat(listPrice) * 1e18); // Convert price to wei (assuming 18 decimals for LORDS)

    try {
      await marketplaceActions.listItem({
        token_id: parseInt(tokens[0].token_id.toString()), // Convert to string to match expected type
        collection_id, // Placeholder: Use actual collection ID if available/needed
        price: priceInWei,
        expiration: listExpiration,
        cancel_order_id: activeMarketOrder?.[0]?.order_id ? BigInt(activeMarketOrder[0].order_id) : BigInt(0),
      });

      setOpen(false);

      //setIsSyncing(true);
    } catch (error) {
      console.error("Failed to list item:", error);
      //setIsSyncing(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="cta" className="w-full mt-2">
          List Item
        </Button>
      </DrawerTrigger>
      <DrawerContent className="text-gold">
        <div className="container mx-auto max-w-5xl">
          <DrawerHeader>
            <DrawerTitle className="text-gold font-semibold text-2xl">List Item</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-2 p-3 bg-background/50 border-t">
            <div className="grid grid-cols-6 gap-2 border-b pb-2 text-xs text-muted-foreground uppercase">
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
                    ((parseFloat(listPrice) * (100 - MARKETPLACE_FEE_PERCENT)) / 100).toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })
                  : 0}
                <span className="ml-3">LORDS</span>
              </div>
            </div>

            {/* Action Buttons */}
          </div>
          <DrawerFooter>
            <div>
              {!collectionApprovedForMarketplace && (
                <div className="flex items-center justify-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border border-yellow dark:border-yellow rounded-md p-2 mb-2">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <span>You need to approve this collection for the marketplace before listing.</span>
                </div>
              )}
              <div className="flex items-center gap-2 w-full justify-end">
                <span className="text-sm font-medium text-muted-foreground ml-2">
                  Expires: {new Date(listExpiration * 1000).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <DrawerClose>
                  <Button variant="outline" size="sm">
                    <ArrowLeft /> Back
                  </Button>
                </DrawerClose>

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
                  {!collectionApprovedForMarketplace ? (
                    <Button onClick={handleApproveMarketplace} disabled={isApprovingMarketplace} size="lg">
                      {isApprovingMarketplace ? "Approving..." : `Approve Marketplace`}
                    </Button>
                  ) : (
                    <Button
                      variant={"cta"}
                      onClick={handleListItem}
                      disabled={isLoading || isSyncing || !listPrice || marketplaceActions.isCreatingOrder}
                    >
                      {marketplaceActions.isCreatingOrder ? "Listing..." : !listPrice ? "Set price" : "Confirm Listing"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
