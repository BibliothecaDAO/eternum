import { ReactComponent as MapIcon } from "@/assets/icons/common/map.svg";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import TwitterShareButton from "@/ui/design-system/molecules/twitter-share-button";
import { SettlementLocation } from "../utils/settlement-types";
import { SettlementMinimapModal } from "@/ui/features/settlement";
import { formatSocialText, twitterTemplates } from "@/ui/socials";
import { getSeasonPassAddress } from "@/utils/addresses";
import { getOffchainRealm, unpackValue } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { RealmInterface, ResourcesIds } from "@bibliothecadao/types";
import { motion } from "framer-motion";
import { gql } from "graphql-request";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { addAddressPadding } from "starknet";
import { env } from "../../../../../env";

const querySeasonPasses = async (accountAddress: string) => {
  const getAccountTokens = gql`
    query getAccountTokens($accountAddress: String!) {
      tokenBalances(accountAddress: $accountAddress, limit: 8000) {
        edges {
          node {
            tokenMetadata {
              __typename
              ... on ERC721__Token {
                tokenId
                contractAddress
                metadataDescription
                imagePath
                metadata
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;
  try {
    const fetchUrl = env.VITE_PUBLIC_TORII + "/graphql";
    const response = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/graphql-response+json",
      },
      body: JSON.stringify({
        query: getAccountTokens,
        variables: { accountAddress },
      }),
    });
    const json = await response.json();

    if ("data" in json) {
      return json.data;
    }

    throw new Error("No data returned from GraphQL");
  } catch (error) {
    console.error("Error querying season passes:", error);
    return null;
  }
};

export const queryRealmCount = async () => {
  const getRealmCount = gql`
    query getRealmCount {
      s1EternumStructureModels(where: { category: 1 }) {
        totalCount
      }
    }
  `;
  try {
    const fetchUrl = env.VITE_PUBLIC_TORII + "/graphql";
    const response = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/graphql-response+json",
      },
      body: JSON.stringify({
        query: getRealmCount,
      }),
    });
    const json = (await response.json()) as { data: { s1EternumStructureModels: { totalCount: number } } };
    return json.data.s1EternumStructureModels.totalCount;
  } catch (error) {
    console.error("Error querying realm count:", error);
    return null;
  }
};

export type SeasonPassRealm = RealmInterface & {
  resourceTypesUnpacked: number[];
  selectedLocation?: SettlementLocation | null;
};

const SettlementSuccessModal = ({
  realmName,
  resources,
  tweetText,
  onClose,
}: {
  realmName: string;
  resources: string;
  tweetText: string;
  onClose: () => void;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="bg-dark-wood border border-gold/20 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center">
            <span className="text-3xl">🏰</span>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gold">Realm Settled!</h3>
            <p className="text-gold/80">
              You have successfully settled <span className="text-gold font-semibold">{realmName}</span>
            </p>
            <p className="text-sm text-gold/60">Resources: {resources}</p>
          </div>

          <div className="flex flex-col gap-3 w-full mt-2">
            <TwitterShareButton
              text={tweetText}
              callToActionText="Share your Realm"
              variant="primary"
              className="w-full"
            />
            <Button variant="outline" onClick={onClose} className="w-full">
              Continue
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const SeasonPassRealm = ({
  seasonPassRealm,
  selected,
  setSelected,
  className,
  onSelectLocation,
  occupiedLocations = [],
  maxLayers,
}: {
  seasonPassRealm: SeasonPassRealm;
  selected: boolean;
  setSelected: (selected: boolean) => void;
  className?: string;
  onSelectLocation?: (realmId: number, location: SettlementLocation | null) => void;
  occupiedLocations?: SettlementLocation[];
  maxLayers: number | null;
}) => {
  const toggleModal = useUIStore((state) => state.toggleModal);
  const resourcesProduced = seasonPassRealm.resourceTypesUnpacked;
  const [isLoading, setIsLoading] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const accountName = useAccountStore((state) => state.accountName);

  const setLocationRef = useRef<SettlementLocation | null>(null);

  const {
    account: { account },
    setup: {
      systemCalls: { create_multiple_realms },
    },
  } = useDojo();

  const settleRealms = async (realmIds: number[]) => {
    if (realmIds.length === 0) return;

    const locationToUseForSettlement = setLocationRef.current;

    setIsLoading(true);
    try {
      const toSettle = [];
      for (const realmId of realmIds) {
        if (!locationToUseForSettlement) {
          console.warn(`Attempted to settle realm ID ${realmId} but location (from ref) is not set. Skipping.`);
          continue;
        }

        toSettle.push({
          realm_id: realmId,
          realm_settlement: {
            side: locationToUseForSettlement.side,
            layer: locationToUseForSettlement.layer,
            point: locationToUseForSettlement.point,
          },
        });
      }

      if (toSettle.length === 0) {
        console.log("No realms are eligible for settlement with the current location information.");
        setIsLoading(false);
        return;
      }

      await create_multiple_realms({
        realms: toSettle,
        owner: account.address,
        frontend: env.VITE_PUBLIC_CLIENT_FEE_RECIPIENT,
        signer: account,
        season_pass_address: getSeasonPassAddress(),
      });
      toast.success("Realms settled successfully");
      setIsSettled(true);
      toggleModal(
        <SettlementSuccessModal
          realmName={seasonPassRealm.name}
          resources={formattedResources}
          tweetText={tweetText}
          onClose={() => toggleModal(null)}
        />,
      );
    } catch (error) {
      toast.error("Error settling realms");
      console.error("Error settling realms:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSelect = (location: SettlementLocation) => {
    console.log("location selected via modal, updating state and ref:", location);

    setLocationRef.current = location;

    if (onSelectLocation) {
      onSelectLocation(seasonPassRealm.realmId, location);
    }
  };

  const handleCancelLocation = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (onSelectLocation && seasonPassRealm.selectedLocation) {
      onSelectLocation(seasonPassRealm.realmId, null);
    }
  };

  const handleConfirmLocation = () => {
    settleRealms([seasonPassRealm.realmId]);
    toggleModal(null);
  };

  const handleSelectLocationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!maxLayers) return;
    toggleModal(
      <SettlementMinimapModal
        onSelectLocation={handleLocationSelect}
        onConfirm={handleConfirmLocation}
        maxLayers={maxLayers}
        realmId={seasonPassRealm.realmId}
        realmName={seasonPassRealm.name}
        extraPlayerOccupiedLocations={occupiedLocations}
      />,
    );
  };

  const normalizedSelectedLocation = useMemo(() => {
    if (!seasonPassRealm.selectedLocation) return null;
    const normalized = new Position({
      x: seasonPassRealm.selectedLocation.x,
      y: seasonPassRealm.selectedLocation.y,
    }).getNormalized();
    return {
      x: normalized.x,
      y: normalized.y,
    };
  }, [seasonPassRealm.selectedLocation]);

  // Format resources for tweet
  const formattedResources = useMemo(() => {
    return resourcesProduced.map((resourceId) => ResourcesIds[resourceId].toUpperCase()).join(", ");
  }, [resourcesProduced]);

  // Format tweet text
  const tweetText = useMemo(() => {
    return formatSocialText(twitterTemplates.realmSettled, {
      addressName: accountName || account.address.slice(0, 6) + "..." + account.address.slice(-4),
      realmName: seasonPassRealm.name,
      realmResources: formattedResources,
      url: env.VITE_SOCIAL_LINK,
    });
  }, [accountName, account.address, seasonPassRealm.name, formattedResources]);

  return (
    <>
      <div
        key={seasonPassRealm.realmId}
        className={`flex flex-col gap-2 p-2 panel-wood rounded-md bg-dark-wood transition-colors duration-200 relative ${
          selected ? "border-gold/40 bg-black/80" : "border-transparent"
        } ${className} border hover:border-gold cursor-pointer`}
        onClick={() => setSelected(!selected)}
      >
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-10 h-10 border-t-2 border-b-2 border-gold rounded-full animate-spin"></div>
          </div>
        )}
        <div className="flex flex-row items-center gap-2 justify-between">
          <h4 className="font-semibold text-gold">{seasonPassRealm.name}</h4>
        </div>
        <div className="flex gap-2 z-10 items-end">
          {resourcesProduced.map((resourceId) => (
            <ResourceIcon
              className=""
              resource={ResourcesIds[resourceId]}
              size="md"
              key={resourceId}
              withTooltip={false}
            />
          ))}
        </div>

        <div className="mt-auto border-t border-gold/20 pt-2">
          {isSettled ? (
            <div className="flex items-center justify-center h-full py-2">
              <h5 className="text-gold font-semibold">Realm Settled!</h5>
            </div>
          ) : normalizedSelectedLocation ? (
            <div className="flex flex-col gap-1">
              <h6 className="text-xs text-gold/70">Selected Location</h6>
              <div className="flex justify-between items-center">
                <h5 className="">
                  ({normalizedSelectedLocation.x}, {normalizedSelectedLocation.y})
                </h5>
                <div className="flex gap-2">
                  <Button onClick={handleCancelLocation} disabled={isLoading} variant="danger" className="!p-1">
                    <span className="text-lg leading-none">✕</span>
                  </Button>
                  <Button onClick={handleSelectLocationClick} disabled={isLoading} variant="primary" className="!p-1">
                    <MapIcon className="w-4 h-4 fill-current" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button
              isPulsing={true}
              onClick={handleSelectLocationClick}
              disabled={isLoading}
              variant="primary"
              size="md"
              className="w-full"
            >
              <div className="flex items-center justify-center gap-2">
                <MapIcon className="w-4 h-4 fill-current" />
                <div>Select Location</div>
              </div>
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export const getUnusedSeasonPasses = async (accountAddress: string, realmIds: number[]) => {
  const balances = await querySeasonPasses(accountAddress);
  const seasonPassAddress = await getSeasonPassAddress();
  return balances?.tokenBalances?.edges
    ?.filter(
      (token: { node: { tokenMetadata: { __typename: string; contractAddress?: string } } }) =>
        token?.node?.tokenMetadata.__typename == "ERC721__Token" &&
        addAddressPadding(token.node.tokenMetadata.contractAddress ?? "0x0") ===
          addAddressPadding(seasonPassAddress ?? "0x0"),
    )
    .map((token: { node: { tokenMetadata: { tokenId: string } } }) => {
      const realmsResourcesPacked = getOffchainRealm(Number(token.node.tokenMetadata.tokenId));
      if (!realmsResourcesPacked) return undefined;
      return {
        ...realmsResourcesPacked,
        resourceTypesUnpacked: unpackValue(realmsResourcesPacked.resourceTypesPacked),
      };
    })
    .filter(
      (realm: SeasonPassRealm): realm is SeasonPassRealm =>
        realm !== undefined && !realmIds.includes(Number(realm.realmId)),
    )
    .sort(
      (a: SeasonPassRealm, b: SeasonPassRealm) =>
        Number(b.resourceTypesUnpacked.length) - Number(a.resourceTypesUnpacked.length),
    );
};
