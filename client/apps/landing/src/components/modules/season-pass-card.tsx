import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { seasonPassAddress } from "@/config";
import { OpenOrderByPrice } from "@/hooks/services";
import { useMarketplace } from "@/hooks/use-marketplace";
import { RealmMetadata } from "@/types";
import { RESOURCE_RARITY, ResourcesIds } from "@bibliothecadao/types"; // Import enums
import { useAccount, useReadContract } from "@starknet-react/core";
import { ArrowRightLeft } from "lucide-react"; // Import the icon
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { Button } from "../ui/button";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { RealmDetailModal } from "./realm-detail-modal";
interface SeasonPassCardProps {
  pass: OpenOrderByPrice;
  toggleNftSelection?: () => void;
  isSelected?: boolean;
  metadata?: RealmMetadata;
  checkOwner?: boolean;
}

interface ListingDetails {
  orderId?: bigint;
  price?: bigint | null;
  isListed: boolean;
  expiration?: string;
}

const SEASON_PASS_COLLECTION_ID = 1;

export const SeasonPassCard = ({ pass, isSelected, toggleNftSelection, checkOwner = false }: SeasonPassCardProps) => {
  const { token_id, metadata } = pass;

  const { address: accountAddress } = useAccount();
  const marketplaceActions = useMarketplace();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [listingDetails, setListingDetails] = useState<ListingDetails>({ isListed: false });

  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  const { data: ownerData, isSuccess: isOwnerSuccess } = useReadContract({
    abi: [
      {
        type: "function",
        name: "owner_of",
        inputs: [{ name: "token_id", type: "core::integer::u256" }],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "view",
      },
    ] as const,
    functionName: "owner_of",
    address: seasonPassAddress as `0x${string}`,
    args: [token_id.toString()],
    enabled: BigInt(pass.owner ?? "0") !== BigInt("0") || checkOwner,
  });

  const isOwner = isOwnerSuccess && ownerData === BigInt(accountAddress ?? "0");

  const orderOwner = BigInt(pass.owner ?? "0") === ownerData || BigInt(pass.owner ?? "0") === BigInt("0");

  // Calculate time remaining for auctions about to expire
  useEffect(() => {
    if (!pass.expiration) return;

    const expirationTime = Number(pass.expiration) * 1000;
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
  }, [pass.expiration]);

  const handleCardClick = () => {
    setIsModalOpen(true);
  };

  const handleTransferClick = () => {
    if (toggleNftSelection) {
      toggleNftSelection();
    }
  };

  const parsedMetadata: RealmMetadata | null = metadata ? JSON.parse(metadata) : null;
  const { attributes, name, image } = parsedMetadata ?? {};

  // Prepare data for the modal (useMemo)
  const modalData = useMemo(
    () => ({
      tokenId: token_id.toString(),
      contractAddress: seasonPassAddress,
      name: name,
      imageSrc: image || "",
      attributes: attributes,
    }),
    [token_id, seasonPassAddress, name, image, attributes],
  );

  const listingActive = useMemo(() => {
    if (pass.expiration !== null && orderOwner && pass.best_price_hex !== null) {
      return true;
    }
    return false;
  }, [pass.expiration, orderOwner, pass.best_price_hex]);

  return (
    <>
      <Card
        // onClick={handleCardClick}
        className={`relative transition-all duration-200 rounded-lg overflow-hidden shadow-md hover:shadow-xl 
          ${isSelected ? "ring-2 ring-offset-2 ring-gold scale-[1.02]" : "hover:ring-1 hover:ring-gold"} 
          cursor-pointer
          // Add visual cues for listed status if desired
          // ${listingDetails.isListed ? "border-green-500" : ""}
        `}
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
          <img
            src={image}
            alt={name ?? "Season Pass"}
            className="w-full object-contain opacity-90 group-hover:opacity-100 transition-all duration-200"
          />
          {/* Selection Indicator */}
          {isSelected && (
            <div className="absolute top-2 right-2 bg-gold text-background px-2 py-0.5 rounded-md text-xs font-bold z-20">
              Selected for Mint
            </div>
          )}
          {/* Listing Indicator (Optional) */}
          {listingDetails.isListed && (
            <div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-0.5 rounded-md text-xs font-bold z-20">
              Listed
            </div>
          )}
        </div>
        <CardHeader className="p-4 pb-2">
          <CardTitle className=" items-center gap-2">
            <div className="uppercase tracking-wider mb-1 flex justify-between items-center text-muted-foreground text-xs">
              Season 1 Pass
            </div>
            <div className="flex justify-between gap-2">
              <h4 className="text-xl truncate">{name || `Pass #${token_id}`}</h4>
            </div>

            <div className="flex flex-wrap gap-2">
              {attributes
                ?.filter((attribute) => attribute.trait_type === "Resource")
                .sort((a, b) => {
                  // Sort resources by rarity
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
        <CardContent className="px-4 pt-2">
          <div className="flex justify-between">
            <div className="flex flex-col">
              {listingActive ? (
                <div className="text-xl  flex items-center gap-2 font-mono">
                  {/* Format price with commas, removing unnecessary decimals */}
                  {Number(formatUnits(pass.best_price_hex ?? BigInt(0), 18)).toLocaleString()}{" "}
                  <ResourceIcon resource="Lords" size="sm" />
                </div>
              ) : (
                <div className="text-xl text-muted-foreground">Not Listed</div>
              )}

              {listingActive && (
                <div className="text-sm text-muted-foreground mt-1">
                  {timeRemaining ? (
                    <span className="text-red-500 font-medium">{timeRemaining}</span>
                  ) : (
                    `Expires ${new Date(Number(pass.expiration) * 1000).toLocaleString()}`
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="border-t items-center bg-card/50 flex flex-col uppercase w-full h-full justify-between text-center p-3 text-sm gap-2">
          <div className="flex w-full gap-4">
            {/* Change Sell button variant */}
            <Button variant={isOwner ? "outline" : "default"} className="w-full" onClick={handleCardClick}>
              {isOwner ? "Manage" : "Buy Now"}
            </Button>

            {isOwner && (
              <Button
                variant="default" // Match Buy button style for emphasis
                size="icon"
                onClick={handleTransferClick}
                title="Transfer Pass" // Add a tooltip for accessibility
              >
                <ArrowRightLeft className="h-4 w-4" /> {/* Use the icon */}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Re-use RealmDetailModal */}
      <RealmDetailModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        realmData={modalData}
        isOwner={isOwner}
        hasSeasonPassMinted={false}
        marketplaceActions={marketplaceActions}
        collection_id={SEASON_PASS_COLLECTION_ID}
        // Pass listing details from state
        price={pass.best_price_hex ?? undefined}
        orderId={pass.order_id?.toString() ?? undefined}
        isListed={pass.expiration !== null}
        expiration={pass.expiration ? Number(pass.expiration) : undefined}
      />
    </>
  );
};
