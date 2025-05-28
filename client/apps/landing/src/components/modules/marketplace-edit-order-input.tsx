import { ArrowLeft } from "lucide-react";
import React from "react";
import { formatUnits } from "viem";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

// Marketplace fee percentage
const MARKETPLACE_FEE_PERCENT = 2.5;

interface EditOrderInputsProps {
  image: string;
  name: string | null;
  price: bigint | null;
  editPrice: string;
  setEditPrice: (price: string) => void;
  isLoading: boolean;
  isSyncing: boolean;
  expiration: number | null;
  handleEditOrder: () => void;
  marketplaceActions: {
    isEditingOrder: boolean;
  };
  setShowEditInputs: (show: boolean) => void;
}

export const EditOrderInputs: React.FC<EditOrderInputsProps> = ({
  image,
  name,
  price,
  editPrice,
  setEditPrice,
  isLoading,
  isSyncing,
  expiration,
  handleEditOrder,
  marketplaceActions,
  setShowEditInputs,
}) => {
  return (
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
      <div>
        <div className="flex items-center gap-2 w-full justify-end">
          <span className="text-sm font-medium text-muted-foreground ml-2">
            Expires: {expiration ? new Date(expiration * 1000).toLocaleString() : "N/A"}
          </span>
        </div>
        <div className="flex justify-between mt-1">
          <Button
            variant="outline"
            onClick={() => setShowEditInputs(false)}
            size="sm"
            disabled={isLoading || isSyncing}
          >
            <ArrowLeft /> Back
          </Button>
          <Button
            onClick={handleEditOrder}
            disabled={isLoading || isSyncing || !editPrice || marketplaceActions.isEditingOrder || editPrice == "0"}
          >
            {marketplaceActions.isEditingOrder ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
};
