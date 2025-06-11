import { useMarketplace } from "@/hooks/use-marketplace";
import { ArrowLeft } from "lucide-react";
import React, { useState } from "react";
import { formatUnits } from "viem";
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

// Marketplace fee percentage
const MARKETPLACE_FEE_PERCENT = 2.5;

interface EditListingDrawerProps {
  image: string;
  name: string | null;
  price: bigint | null;
  isLoading: boolean;
  isSyncing: boolean;
  orderId: string;
  expiration: number | null;
  marketplaceActions: ReturnType<typeof useMarketplace>;
}

export const EditListingDrawer: React.FC<EditListingDrawerProps> = ({
  image,
  name,
  price,
  orderId,
  isLoading,
  isSyncing,
  expiration,
  marketplaceActions,
}) => {
  const [editPrice, setEditPrice] = useState(price ? formatUnits(price, 18) : "");
  const [open, setOpen] = useState(false);

  const handleEditOrder = async () => {
    if (!orderId || !editPrice) return; // Basic validation
    const priceInWei = BigInt(parseFloat(editPrice) * 1e18); // Convert price to wei

    try {
      const tx = await marketplaceActions.editOrder({
        order_id: BigInt(orderId),
        new_price: priceInWei,
      });

      if (tx) {
        setOpen(false);
      }
    } catch (error) {
      console.error("Failed to edit order:", error);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="secondary" size="sm" disabled={isLoading || isSyncing}>
          Edit Listing
        </Button>
      </DrawerTrigger>
      <DrawerContent className="text-gold">
        <div className="container mx-auto max-w-5xl">
          <DrawerHeader>
            <DrawerTitle className="text-gold font-semibold text-2xl">Edit Listing</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-2 p-3 bg-background/50 border-t">
            <div className="grid grid-cols-6 gap-2 border-b pb-2 text-xs font-semibold text-muted-foreground">
              <div className="col-span-2">Item</div>
              <div>Current</div>
              <div>Fee</div>
              <div className="justify-self-end col-span-2">New Price</div>
            </div>
            <div className="grid grid-cols-6 gap-2 items-center py-2">
              <div className="flex items-center gap-2 col-span-2">
                <img src={image} alt={name ?? "Realm"} className="w-8 h-8 rounded" />
                <span className="truncate max-w-[80px]">{name}</span>
              </div>
              <div className="text-sm">
                {price
                  ? parseFloat(formatUnits(price, 18)).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "-"}
              </div>
              <div className="text-xs">
                {editPrice && parseFloat(editPrice) > 0
                  ? ((parseFloat(editPrice) * MARKETPLACE_FEE_PERCENT) / 100).toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })
                  : "--"}
                <span className="ml-1">LORDS</span>
              </div>
              <div className="justify-self-end relative col-span-2">
                <Input
                  id="edit-price"
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder="0"
                  disabled={isLoading || isSyncing}
                  className="w-full max-w-36"
                />
                <span className="absolute text-xs right-1.5 top-2.5">LORDS</span>
              </div>
            </div>
            {/* Proceeds below the table */}
            <div className="mb-1 flex justify-between border-t py-3 font-semibold">
              <span>You receive: </span>
              <div>
                {editPrice
                  ? parseFloat(editPrice) > 0 &&
                    ((parseFloat(editPrice) * (100 - MARKETPLACE_FEE_PERCENT)) / 100).toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })
                  : 0}
                <span className="ml-3">LORDS</span>
              </div>
            </div>

            {/* Action Buttons */}
            <DrawerFooter>
              <div>
                <div className="flex items-center gap-2 w-full justify-end">
                  <span className="text-sm font-medium text-muted-foreground ml-2">
                    Expires: {expiration ? new Date(expiration * 1000).toLocaleString() : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <DrawerClose>
                    <Button variant="outline" size="sm" disabled={isLoading || isSyncing}>
                      <ArrowLeft /> Back
                    </Button>
                  </DrawerClose>

                  <Button
                    onClick={handleEditOrder}
                    disabled={
                      isLoading || isSyncing || !editPrice || marketplaceActions.isEditingOrder || editPrice == "0"
                    }
                  >
                    {marketplaceActions.isEditingOrder ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </DrawerFooter>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
