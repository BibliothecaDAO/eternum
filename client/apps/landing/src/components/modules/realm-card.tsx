import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useDojo } from "@/hooks/context/dojo-context";
import { AugmentedRealm } from "@/routes/mint.lazy";
import { RealmMetadata } from "@/types";
import { useAccount } from "@starknet-react/core";
import { CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResourceIcon } from "../ui/elements/resource-icon";

// Placeholder for loading state - could be a simple spinner or a blurred low-res image
const IMAGE_PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="; // Transparent 1x1 gif

interface RealmCardProps {
  realm: AugmentedRealm;
  toggleNftSelection?: (tokenId: string, collectionAddress: string) => void;
  isSelected?: boolean;
  metadata?: RealmMetadata;
  onSeasonPassStatusChange?: (tokenId: string, hasMinted: boolean) => void;
}

interface ListingDetails {
  orderId?: bigint; // Assuming order_id is u64, represented as bigint
  price?: bigint; // Assuming price is u128, represented as bigint
  isListed: boolean;
}

export const RealmCard = ({ realm, isSelected, toggleNftSelection, onSeasonPassStatusChange }: RealmCardProps) => {
  const { tokenId, contractAddress } = {
    tokenId: BigInt(realm.tokenId),
    contractAddress: realm.originalRealm?.contract_address,
  };
  /*{ tokenId: "", contractAddress: "", metadata: "" };*/

  const { attributes, name, image: originalImageUrl } = realm.parsedMetadata ?? {};

  const { address: accountAddress } = useAccount();

  const {
    setup: { components },
  } = useDojo();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [listingDetails, setListingDetails] = useState<ListingDetails>({ isListed: false });

  const isOwner = realm.originalRealm?.account_address === (accountAddress ?? "");

  // --- Image Loading State & Logic ---
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageSrc, setImageSrc] = useState<string>(originalImageUrl || IMAGE_PLACEHOLDER);
  const [imageLoadAttempts, setImageLoadAttempts] = useState(0);
  const MAX_IMAGE_LOAD_ATTEMPTS = 1;

  useEffect(() => {
    setImageSrc(originalImageUrl || IMAGE_PLACEHOLDER);
  }, [originalImageUrl]);

  const handleImageError = useCallback(() => {
    if (imageLoadAttempts < MAX_IMAGE_LOAD_ATTEMPTS) {
      setImageLoadAttempts((prev) => prev + 1);
      const retrySrc = originalImageUrl ? `${originalImageUrl}?retry=${imageLoadAttempts + 1}` : IMAGE_PLACEHOLDER;
      setImageSrc(retrySrc);
    } else {
      console.error(`Failed to load image after ${MAX_IMAGE_LOAD_ATTEMPTS} retries: ${originalImageUrl}`);
      setImageSrc(IMAGE_PLACEHOLDER);
    }
  }, [originalImageUrl, imageLoadAttempts]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && imageSrc === IMAGE_PLACEHOLDER && originalImageUrl) {
          setImageSrc(originalImageUrl);
          observer.unobserve(entry.target);
        }
      },
      {
        rootMargin: "0px",
        threshold: 0.1,
      },
    );

    const currentRef = cardRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [originalImageUrl, imageSrc]);

  const handleCardClick = () => {
    if (toggleNftSelection) {
      toggleNftSelection(tokenId.toString(), contractAddress ?? "0x");
    }
    setIsModalOpen(true);
  };

  /**useEffect(() => {
    if (isSeasonPassMintedSuccess && onSeasonPassStatusChange && tokenId) {
      onSeasonPassStatusChange(tokenId.toString(), !!seasonPassOwnerData);
    }
  }, [isSeasonPassMintedSuccess, seasonPassOwnerData, tokenId]);*/

  // --- Fetch Marketplace Listing Status ---
  // Placeholder: Replace with actual logic to query Dojo state for MarketOrderModel
  useEffect(() => {
    const fetchListingStatus = async () => {
      if (!tokenId || !contractAddress) return;

      // Placeholder: Replace with actual function call
      // const orderModel = await getMarketOrderModel(tokenId, contractAddress, components);
      const orderModel: any = null; // Simulate no order found (using any for placeholder)

      if (orderModel && orderModel.order.active) {
        setListingDetails({
          isListed: true,
          // orderId: orderModel.order_id, // Assuming the model structure
          // price: orderModel.order.price, // Assuming the model structure
        });
      } else {
        setListingDetails({ isListed: false });
      }
    };

    fetchListingStatus();
  }, [tokenId, contractAddress, components]); // Add components dependency

  const hasSeasonPassMinted = realm.seasonPassMinted;
  //const isLoadingStatus =  isFetchingRealmOwner;

  return (
    <>
      <Card
        ref={cardRef}
        onClick={hasSeasonPassMinted ? undefined : handleCardClick}
        className={`group relative transition-all duration-200 rounded-lg overflow-hidden shadow-md hover:shadow-xl 
          ${hasSeasonPassMinted ? "cursor-not-allowed" : "cursor-pointer hover:ring-1 hover:ring-gold/50"} 
          ${isSelected ? "ring-2 ring-offset-2 ring-blue-500/50 scale-[1.02]" : ""} 
        `}
      >
        <div
          className={`absolute inset-0 opacity-5 
          ${hasSeasonPassMinted ? "bg-dark-green" : isOwner ? "bg-blue-900" : ""} 
          pointer-events-none`}
        />

        {/* Status Indicator Icon (Top Right) */}
        {!isSelected && (
          <div
            className={`absolute top-2 right-2 z-20 p-1 rounded-full bg-card/80 backdrop-blur-sm`}
            title={hasSeasonPassMinted ? "Season Pass Minted" : "Season Pass Available"}
          >
            {hasSeasonPassMinted ? <CheckCircle2 className="w-5 h-5 text-lime-500" /> : null}
          </div>
        )}

        {/* Main card content starts below */}
        <div className="relative z-10 bg-card/95">
          <div className="relative">
            <img
              src={imageSrc}
              alt={name ?? "Realm Image"}
              className={`w-full object-cover h-40 sm:h-48 transition-all duration-200
                ${hasSeasonPassMinted ? "opacity-50 filter grayscale brightness-75" : "opacity-90 group-hover:opacity-75"}
                ${imageSrc === IMAGE_PLACEHOLDER ? "animate-pulse bg-gray-200" : ""}
              `}
              onError={handleImageError}
              loading="lazy"
            />
          </div>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="items-center gap-2">
              <div className="flex justify-between gap-2">
                <h5 className="text-xl truncate">{name || "Unnamed Realm"}</h5>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
              {attributes
                ?.filter((attribute) => attribute.trait_type === "Resource")
                .map((attribute, index) => (
                  <ResourceIcon
                    resource={attribute.value as string}
                    size="sm"
                    key={`${attribute.trait_type}-${index}`}
                  />
                ))}
            </div>
          </CardContent>
          {attributes?.find((attribute) => attribute.trait_type === "Wonder")?.value && (
            <CardFooter className="border-t items-center bg-card/50 flex uppercase flex-wrap w-full h-full justify-center text-center p-3 text-sm">
              <span className="text-gold font-bold tracking-wide truncate">
                {attributes.find((attribute) => attribute.trait_type === "Wonder")?.value}
              </span>
            </CardFooter>
          )}
        </div>
      </Card>

      {/* <RealmDetailModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        realmData={realmModalData}
        isOwner={isOwner}
        hasSeasonPassMinted={hasSeasonPassMinted}
        marketplaceActions={marketplaceActions}
        collection_id={2}
        {...listingDetails}
      /> */}
    </>
  );
};
