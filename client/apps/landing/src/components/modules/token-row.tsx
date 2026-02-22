import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getCollectionByAddress } from "@/config";
import { useMarketplace } from "@/hooks/use-marketplace";
import { trimAddress } from "@/lib/utils";
import { MergedNftData } from "@/types";
import { COSMETIC_NAMES } from "@/utils/cosmetics";
import { RESOURCE_RARITY, ResourcesIds } from "@bibliothecadao/types";
import { useAccount } from "@starknet-react/core";
import Check from "lucide-react/dist/esm/icons/check";
import ImageOff from "lucide-react/dist/esm/icons/image-off";
import Plus from "lucide-react/dist/esm/icons/plus";
import { useState } from "react";
import { formatUnits } from "viem";
import { Button } from "../ui/button";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { TokenDetailModal } from "./token-detail-modal";
import { CollectionType } from "./token-card";

interface TokenRowProps {
  token: MergedNftData;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  toggleNftSelection?: () => void;
}

export const TokenRow = ({ token, isSelected = false, onToggleSelection, toggleNftSelection }: TokenRowProps) => {
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

  const getCollectionType = (name?: string): CollectionType => {
    if (name === "Loot Chest") return CollectionType.LootChest;
    if (name === "Cosmetics") return CollectionType.Cosmetics;
    return CollectionType.Other;
  };

  const collectionType = getCollectionType(collectionName);

  const { attributes, name, image: originalImage } = metadata ?? {};

  const image = originalImage?.startsWith("ipfs://")
    ? originalImage.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")
    : originalImage;

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

  const resourceAttributes = attributes
    ?.filter((attribute) => attribute.trait_type === "Resource")
    .toSorted((a, b) => {
      const aWithoutSpace = a.value.toString().replace(/\s/g, "");
      const bWithoutSpace = b.value.toString().replace(/\s/g, "");
      const idA = ResourcesIds[aWithoutSpace as keyof typeof ResourcesIds];
      const idB = ResourcesIds[bWithoutSpace as keyof typeof ResourcesIds];
      const rarityA = (idA !== undefined ? RESOURCE_RARITY[idA] : undefined) || Infinity;
      const rarityB = (idB !== undefined ? RESOURCE_RARITY[idB] : undefined) || Infinity;
      return rarityA - rarityB;
    });

  return (
    <>
      <div
        onClick={canToggleSelection ? handleToggleSelection : undefined}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all duration-150
          ${isSelected ? "ring-1 ring-gold bg-gold/5 border-gold/40" : "border-border hover:border-gold/30 hover:bg-accent/30"}
          ${isDisabledCard ? "border-orange-500/40 bg-orange-500/[0.06]" : ""}
          ${canToggleSelection ? "cursor-pointer" : "cursor-default"}
          group`}
      >
        {/* Thumbnail */}
        <div className="relative flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border border-border/50">
          {image && !imageError ? (
            <img
              src={image}
              alt={name ?? "Token Image"}
              className={`w-full h-full object-cover transition-all duration-200
                ${isDisabledCard ? "opacity-60 saturate-50" : isSelected ? "opacity-100" : "opacity-90 group-hover:opacity-100"}`}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-slate-800 flex items-center justify-center">
              <ImageOff className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Name + collection */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground truncate">{collectionName}</div>
          <div className="font-medium text-sm truncate">{displayName}</div>
        </div>

        {/* Resources */}
        <div className="hidden sm:flex items-center gap-1 flex-shrink-0 max-w-[160px] flex-wrap">
          {resourceAttributes?.map((attribute, index) => (
            <ResourceIcon
              resource={attribute.value as string}
              size="sm"
              key={`${attribute.trait_type}-${index}`}
            />
          ))}
        </div>

        {/* Status badge */}
        <div className="flex-shrink-0 w-28 text-right">
          {isActuallyListed ? (
            <span className="inline-block bg-green-600/20 text-green-500 border border-green-600/30 text-xs px-2 py-0.5 rounded font-medium">
              Listed
            </span>
          ) : listingOwnerMismatch ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs px-2 py-0.5 rounded font-medium cursor-help">
                    Invalid
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Owner has changed since this listing was created.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="text-xs text-muted-foreground">Not Listed</span>
          )}
        </div>

        {/* Price */}
        <div className="flex-shrink-0 w-36 text-right">
          {listingActive ? (
            <div
              className={`flex items-center justify-end gap-1.5 font-mono text-sm ${isDisabledCard ? "opacity-60" : ""}`}
            >
              {Number(formatUnits(BigInt(token.best_price_hex ?? 0), 18)).toLocaleString()}
              <ResourceIcon withTooltip={false} resource="Lords" size="sm" />
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>

        {/* Action */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {canToggleSelection && (
            <div
              className={`rounded-full border font-bold transition-colors duration-150 p-0.5
                ${isSelected ? "bg-gold text-background border-gold" : "bg-transparent border-border group-hover:border-gold"}`}
            >
              {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
          )}
          <Button
            size="sm"
            variant={isOwner ? "outline" : isActuallyListed ? "default" : "ghost"}
            className="text-xs h-7 px-3"
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
          >
            {isOwner ? "Manage" : isActuallyListed ? "Buy" : "Details"}
          </Button>
        </div>
      </div>

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
