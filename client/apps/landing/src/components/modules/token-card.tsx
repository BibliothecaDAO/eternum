import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getCollectionByAddress } from "@/config";
import { useMarketplace } from "@/hooks/use-marketplace";
import { trimAddress } from "@/lib/utils";
import { MergedNftData } from "@/types";
import { COSMETIC_NAMES } from "@/utils/cosmetics";
import { RESOURCE_RARITY, ResourcesIds } from "@bibliothecadao/types";
import { useAccount } from "@starknet-react/core";
import { ArrowRightLeft, Check, ImageOff, Plus } from "lucide-react";
import { useState } from "react";
import { formatUnits } from "viem";
import { Button } from "../ui/button";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { TokenDetailModal } from "./token-detail-modal";

export enum CollectionType {
  LootChest = "Loot Chest",
  Cosmetics = "Cosmetics",
  Other = "Other",
}

interface TokenCardProps {
  token: MergedNftData;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  toggleNftSelection?: () => void;
  totalOwnedChests?: number;
}

export const TokenCard = ({
  token,
  isSelected = false,
  onToggleSelection,
  toggleNftSelection,
  totalOwnedChests = 0,
}: TokenCardProps) => {
  const { token_id, metadata, contract_address } = token;
  const { address: accountAddress } = useAccount();
  const marketplaceActions = useMarketplace();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const normalizedAccountAddress = accountAddress ? trimAddress(accountAddress)?.toLowerCase() : undefined;
  const normalizedTokenOwner = token.token_owner ? trimAddress(token.token_owner)?.toLowerCase() : undefined;
  const normalizedOrderOwner = token.order_owner ? trimAddress(token.order_owner)?.toLowerCase() : undefined;
  const isOwner = normalizedTokenOwner ? normalizedTokenOwner === normalizedAccountAddress : true;
  const listingActive = token.expiration !== null && token.best_price_hex !== null;
  const listingOwnerMismatch =
    listingActive && normalizedOrderOwner && normalizedTokenOwner && normalizedOrderOwner !== normalizedTokenOwner;
  const isActuallyListed = listingActive && !listingOwnerMismatch;
  const isDisabledCard = listingOwnerMismatch;
  const collection = getCollectionByAddress(contract_address);
  const collectionName = collection?.name;

  // Determine collection type based on collection name
  const getCollectionType = (name?: string): CollectionType => {
    if (name === "Loot Chest") return CollectionType.LootChest;
    if (name === "Cosmetics") return CollectionType.Cosmetics;
    return CollectionType.Other;
  };

  const collectionType = getCollectionType(collectionName);

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
  };
  const handleTransferClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toggleNftSelection) {
      toggleNftSelection();
    }
  };

  const { attributes, name, image: originalImage } = metadata ?? {};

  // Transform IPFS URLs to use Pinata gateway
  const image = originalImage?.startsWith("ipfs://")
    ? originalImage.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")
    : originalImage;

  // Determine display name for cosmetics based on attributes
  const getDisplayName = () => {
    if (collectionType === CollectionType.Cosmetics && attributes) {
      const epochAttr = attributes.find((attr) => attr.trait_type === "Epoch");
      const idAttr = attributes.find((attr) => attr.trait_type === "Epoch Item");
      if (epochAttr && idAttr) {
        const cosmetic = COSMETIC_NAMES.find((c) => c.id === idAttr.value && c.epoch === epochAttr.value);
        return cosmetic ? cosmetic.name : name || "N/A";
      }
    }
    return `${name} #${parseInt(token_id?.toString())}` || "N/A";
  };

  const displayName = getDisplayName();

  const canToggleSelection = Boolean(onToggleSelection && (isOwner || isActuallyListed));

  const handleToggleSelection = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onToggleSelection?.();
  };

  return (
    <>
      <Card
        onClick={canToggleSelection ? handleToggleSelection : undefined}
        className={`relative transition-all duration-200 rounded-lg overflow-hidden shadow-md hover:shadow-xl
          ${isSelected ? "ring-1 ring-gold scale-[1.01] bg-gold/5" : canToggleSelection ? "hover:ring-1 hover:ring-gold hover:bg-gold/5" : ""}
          ${isDisabledCard ? "ring-2 ring-orange-500/40 bg-orange-500/[0.08]" : ""}
          ${canToggleSelection ? "cursor-pointer" : "cursor-default"} group`}
      >
        <div className="relative">
          {attributes?.find((attribute) => attribute.trait_type === "Wonder")?.value && (
            <div className="absolute z-10 top-0 border-t items-center flex uppercase flex-wrap w-full py-2 justify-center text-center text-sm bg-crimson/50 rounded-t-lg">
              <span className="text-gold font-bold tracking-wide truncate">
                {attributes.find((attribute) => attribute.trait_type === "Wonder")?.value}
                <br />
                (+20% production)
              </span>
            </div>
          )}
          {image && !imageError ? (
            <img
              src={image}
              alt={name ?? "Token Image"}
              className={`w-full object-contain transition-all duration-200 ${
                isDisabledCard
                  ? "opacity-60 saturate-50 contrast-90 brightness-95"
                  : isSelected
                    ? "opacity-100"
                    : "opacity-90 group-hover:opacity-100"
              }`}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full aspect-square bg-slate-800 flex items-center justify-center">
              <ImageOff className="w-16 h-16 " />
            </div>
          )}

          {/* Selection overlay appears when this card can be toggled */}
          {canToggleSelection && (
            <div
              className={`absolute inset-0 bg-black/50 flex items-start justify-end transition-opacity duration-200
              ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
            >
              <div className="bg-gold text-background rounded-full font-bold m-2">
                {isSelected ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </div>
            </div>
          )}

          {/* Listing Indicator */}
          {isActuallyListed && (
            <div className="absolute top-2 left-2 bg-green-600 border border-green-700 text-white px-2 py-0.5 rounded-md text-xs font-bold z-20 opacity-100 shadow-md">
              Listed
            </div>
          )}

          {/* Invalid Listing Indicator */}
          {listingOwnerMismatch && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="absolute top-2 left-2 bg-orange-500 border border-orange-500/80 text-white px-2 py-0.5 rounded-md text-xs font-bold z-20 opacity-100 shadow-md cursor-help">
                    Invalid Listing
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>This listing is no longer valid. The token owner has changed since the listing was created.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <CardHeader className={`p-4 pb-2 ${isSelected ? "bg-gold/5" : ""}`}>
          <CardTitle className="items-center gap-2">
            <div className="flex flex-col gap-2">
              <div className="text-muted-foreground text-xs">{collectionName}</div>
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-xl truncate">{displayName}</h4>
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              {attributes
                ?.filter((attribute) => attribute.trait_type === "Resource")
                .sort((a, b) => {
                  const aWithoutSpace = a.value.toString().replace(/\s/g, "");
                  const bWithoutSpace = b.value.toString().replace(/\s/g, "");
                  const idA = ResourcesIds[aWithoutSpace as keyof typeof ResourcesIds];
                  const idB = ResourcesIds[bWithoutSpace as keyof typeof ResourcesIds];
                  const rarityA = (idA !== undefined ? RESOURCE_RARITY[idA] : undefined) || Infinity;
                  const rarityB = (idB !== undefined ? RESOURCE_RARITY[idB] : undefined) || Infinity;
                  return rarityA - rarityB;
                })
                .map((attribute, index) => (
                  <ResourceIcon
                    resource={attribute.value as string}
                    size="sm"
                    key={`${attribute.trait_type}-${index}`}
                  />
                ))}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className={`px-4 pt-2 ${isSelected ? "bg-gold/5" : ""}`}>
          <div className="flex justify-between">
            <div className="flex flex-col">
              {listingActive ? (
                listingOwnerMismatch ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-xl flex items-center gap-2 font-mono cursor-help opacity-60">
                          {Number(formatUnits(BigInt(token.best_price_hex ?? 0), 18)).toLocaleString()}{" "}
                          <ResourceIcon withTooltip={false} resource="Lords" size="sm" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>This listing price is no longer valid. The token owner has changed.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <div className="text-xl flex items-center gap-2 font-mono">
                    {Number(formatUnits(BigInt(token.best_price_hex ?? 0), 18)).toLocaleString()}{" "}
                    <ResourceIcon withTooltip={false} resource="Lords" size="sm" />
                  </div>
                )
              ) : (
                <div className="text-xl text-muted-foreground">Not Listed</div>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter
          className={`border-t items-center bg-card/50 flex flex-col uppercase w-full h-full justify-between text-center p-3 text-sm gap-2
          ${isSelected ? "bg-gold/5" : ""}`}
        >
          <div className="flex w-full gap-4">
            {isOwner && collectionType === CollectionType.LootChest ? (
              <>
                <Button disabled={isSelected} variant="outline" className="w-full" onClick={handleCardClick}>
                  Manage
                </Button>
              </>
            ) : (
              <Button
                disabled={isSelected}
                variant={isOwner ? "outline" : isActuallyListed ? "default" : "ghost"}
                className="w-full"
                onClick={handleCardClick}
              >
                {isOwner ? "Manage" : isSelected ? "Selected" : !isActuallyListed ? "Show Details" : "Buy Now"}
              </Button>
            )}

            {isOwner && (
              <Button variant="default" size="icon" onClick={handleTransferClick} title="Transfer Pass">
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {collection?.id && isModalOpen && (
        <TokenDetailModal
          onOpenChange={setIsModalOpen}
          isOpen={isModalOpen}
          collectionType={collectionType}
          tokenData={token}
          isOwner={isOwner}
          marketplaceActions={marketplaceActions}
          price={token.best_price_hex ? BigInt(token.best_price_hex) : undefined}
          orderId={token.order_id?.toString() ?? undefined}
          isListed={token.expiration !== null}
          expiration={token.expiration ? Number(token.expiration) : undefined}
          displayName={displayName}
        />
      )}
    </>
  );
};
