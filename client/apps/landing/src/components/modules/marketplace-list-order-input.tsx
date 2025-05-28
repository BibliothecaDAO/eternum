import { ArrowLeft } from "lucide-react";
import React from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

// Marketplace fee percentage
const MARKETPLACE_FEE_PERCENT = 2.5;

interface ListOrderInputsProps {
  image: string;
  name: string | null;
  listPrice: string;
  setListPrice: (price: string) => void;
  isLoading: boolean;
  isSyncing: boolean;
  listExpiration: number;
  selectedDuration: string;
  handleDurationChange: (value: string) => void;
  handleListItem: () => void;
  marketplaceActions: {
    isCreatingOrder: boolean;
  };
  setShowListInputs: (show: boolean) => void;
}

export const ListOrderInputs: React.FC<ListOrderInputsProps> = ({
  image,
  name,
  listPrice,
  setListPrice,
  isLoading,
  isSyncing,
  listExpiration,
  selectedDuration,
  handleDurationChange,
  handleListItem,
  marketplaceActions,
  setShowListInputs,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-background/50 border-t">
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
              ((parseFloat(listPrice) * (100 - MARKETPLACE_FEE_PERCENT)) / 100).toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })
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
            <Select value={selectedDuration} disabled={isLoading || isSyncing} onValueChange={handleDurationChange}>
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
              disabled={isLoading || isSyncing || !listPrice || marketplaceActions.isCreatingOrder}
            >
              {marketplaceActions.isCreatingOrder ? "Listing..." : !listPrice ? "Set price" : "Confirm Listing"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
