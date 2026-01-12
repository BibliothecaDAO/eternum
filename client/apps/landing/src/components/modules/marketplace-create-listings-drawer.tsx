import { getCollectionByAddress } from "@/config";
import { fetchActiveMarketOrders } from "@/hooks/services";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useMarketplaceApproval } from "@/hooks/use-marketplace-approval";
import { MergedNftData } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Minus, Plus } from "lucide-react";
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

// Function to extract unique contract addresses

interface CreateListingsDrawerProps {
  tokens: MergedNftData[];
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

export const CreateListingsDrawer: React.FC<CreateListingsDrawerProps> = ({
  tokens,
  isLoading,
  isSyncing,
  marketplaceActions,
}) => {
  const [open, setOpen] = useState(false);
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [incrementAmount, setIncrementAmount] = useState("250");
  const [showIncrementInput, setShowIncrementInput] = useState(false);
  const [hasUsedIncrement, setHasUsedIncrement] = useState(false);

  const selectedCollectionAddresses = [...new Set(tokens.map((token) => token.contract_address))];

  const { collectionApprovedForMarketplace, isApprovingMarketplace, handleApproveMarketplace } =
    useMarketplaceApproval(selectedCollectionAddresses);

  const calculateExpirationTimestamp = (durationKey: DurationKey): number => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return nowInSeconds + durationOptions[durationKey];
  };

  const [selectedDuration, setSelectedDuration] = useState<DurationKey>("7days");
  const [listExpiration, setListExpiration] = useState<number>(() => calculateExpirationTimestamp("7days"));

  // Handler for duration change
  const handleDurationChange = (value: string) => {
    const durationKey = value as DurationKey;
    setSelectedDuration(durationKey);
    setListExpiration(calculateExpirationTimestamp(durationKey));
  };

  const { data: activeMarketOrder } = useQuery({
    queryKey: ["activeMarketOrders", tokens?.[0]?.contract_address, tokens.map((t) => t.token_id.toString())],
    queryFn: () =>
      fetchActiveMarketOrders(
        tokens?.[0]?.contract_address, //needs to be changed for multipl collections
        tokens.map((t) => t.token_id.toString()),
      ),
    refetchInterval: 30_000,
  });

  // Handler for price change
  const handlePriceChange = (tokenId: string, price: string) => {
    setTokenPrices((prev) => ({
      ...prev,
      [tokenId]: price,
    }));
  };

  const handleIncrement = (isIncrement: boolean) => {
    const amount = parseFloat(incrementAmount) || 0;
    const newPrices: Record<string, string> = {};

    tokens.forEach((token) => {
      const currentPrice = parseFloat(tokenPrices[token.token_id.toString()] || "0");
      const newPrice = isIncrement ? currentPrice + amount : Math.max(0, currentPrice - amount);
      newPrices[token.token_id.toString()] = newPrice.toString();
    });

    setTokenPrices(newPrices);
    setHasUsedIncrement(true);
  };

  const handleBulkList = async () => {
    try {
      const tokensToProcess = tokens.filter((token) => tokenPrices[token.token_id.toString()]);
      console.log(tokensToProcess);
      if (tokensToProcess.length === 0) return;

      await marketplaceActions.listItems({
        tokens: tokensToProcess.map((token) => {
          const existingOrder = activeMarketOrder?.find((order) => {
            return order.token_id.toString() === token.token_id.toString();
          });
          return {
            token_id: parseInt(token.token_id.toString()),
            collection_id: getCollectionByAddress(token.contract_address.toString())?.id ?? 0,
            price: BigInt(parseFloat(tokenPrices[token.token_id.toString()]) * 1e18),
            expiration: listExpiration,
            cancel_order_id: existingOrder?.order_id ? BigInt(existingOrder.order_id) : null,
          };
        }),
      });
      setOpen(false);
    } catch (error) {
      console.error("Failed to list items:", error);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button disabled={tokens.length === 0} variant="cta" className="w-full">
          List {tokens.length <= 1 ? "Item" : `${tokens.length} Items`}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="text-gold">
        <div className="container mx-auto max-w-5xl">
          <DrawerHeader className="flex justify-between items-center">
            <DrawerTitle className="text-gold font-semibold text-2xl">List Items</DrawerTitle>
            <div className="flex items-center gap-2">
              <span className="uppercase text-xs mr-4">Set All to</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newPrices: Record<string, string> = {};
                  tokens.forEach((token) => {
                    if (token.collection_floor_price) {
                      newPrices[token.token_id.toString()] = token.collection_floor_price.toString();
                    }
                  });
                  setTokenPrices(newPrices);
                }}
              >
                Floor Price
              </Button>
            </div>
          </DrawerHeader>
          <div className="flex flex-col gap-2 p-3">
            <div className="grid grid-cols-6 gap-2 border-b pb-2 text-xs text-muted-foreground uppercase">
              <div className="col-span-2">Item</div>
              <div>Floor</div>
              <div>Fee</div>
              <div className="justify-self-end col-span-2">
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleIncrement(false)}
                    disabled={isLoading || isSyncing}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  {hasUsedIncrement &&
                    (showIncrementInput ? (
                      <Input
                        type="number"
                        value={incrementAmount}
                        onChange={(e) => setIncrementAmount(e.target.value)}
                        className="w-24 text-lg"
                        onBlur={() => setShowIncrementInput(false)}
                        autoFocus
                      />
                    ) : (
                      <Button
                        variant="outline"
                        className="text-lg"
                        size="sm"
                        onClick={() => setShowIncrementInput(true)}
                      >
                        {incrementAmount}
                      </Button>
                    ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleIncrement(true)}
                    disabled={isLoading || isSyncing}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[60vH]">
              {tokens.map((token) => {
                const imageSrc = token.metadata?.image?.startsWith("ipfs://")
                  ? token.metadata?.image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")
                  : token.metadata?.image;
                return (
                  <div key={token.token_id.toString()} className="grid grid-cols-6 gap-2 items-center py-2">
                    <div className="flex items-center gap-2 col-span-2">
                      <img
                        src={
                          token.metadata?.image?.startsWith("ipfs://")
                            ? token.metadata?.image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")
                            : token.metadata?.image
                        }
                        alt={token.metadata?.name ?? "Token"}
                        className="w-8 h-8 rounded"
                      />
                      <span className="truncate max-w-[120px]">{token.metadata?.name}</span>
                    </div>
                    <div className="text-xs">{token.collection_floor_price?.toLocaleString()} LORDS</div>
                    <div className="text-xs">
                      {tokenPrices[token.token_id.toString()] && parseFloat(tokenPrices[token.token_id.toString()]) > 0
                        ? (
                            (parseFloat(tokenPrices[token.token_id.toString()]) * MARKETPLACE_FEE_PERCENT) /
                            100
                          ).toLocaleString("en-US", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })
                        : "--"}
                      <span className="ml-1">LORDS</span>
                    </div>
                    <div className="justify-self-end relative col-span-2">
                      <Input
                        id={`list-price-${token.token_id}`}
                        value={tokenPrices[token.token_id.toString()] || ""}
                        onChange={(e) => handlePriceChange(token.token_id.toString(), e.target.value)}
                        placeholder="0"
                        disabled={isLoading || isSyncing}
                        className="w-full max-w-36"
                      />
                      <span className="absolute text-xs right-1.5 top-2.5">LORDS</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Proceeds below the table */}
            <div className="mb-1 flex justify-between border-t py-3 font-semibold">
              <span>Total proceeds: </span>
              <div>
                {Object.values(tokenPrices)
                  .reduce((total, price) => {
                    if (!price || parseFloat(price) <= 0) return total;
                    return total + (parseFloat(price) * (100 - MARKETPLACE_FEE_PERCENT)) / 100;
                  }, 0)
                  .toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                <span className="ml-3">LORDS</span>
              </div>
            </div>
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
                      onClick={handleBulkList}
                      disabled={
                        isLoading ||
                        isSyncing ||
                        tokens.some((token) => !tokenPrices[token.token_id.toString()]) ||
                        marketplaceActions.isCreatingOrder
                      }
                    >
                      {marketplaceActions.isCreatingOrder
                        ? "Listing..."
                        : tokens.some((token) => !tokenPrices[token.token_id.toString()])
                          ? "Set prices"
                          : "List All Items"}
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
