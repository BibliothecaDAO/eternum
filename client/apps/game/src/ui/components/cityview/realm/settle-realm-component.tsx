import { ReactComponent as CheckboxChecked } from "@/assets/icons/checkbox-checked.svg";
import { ReactComponent as CheckboxUnchecked } from "@/assets/icons/checkbox-unchecked.svg";
import { ReactComponent as MapIcon } from "@/assets/icons/common/map.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import { SettlementMinimapModal } from "@/ui/components/settlement/settlement-minimap-modal";
import { SettlementLocation } from "@/ui/components/settlement/settlement-types";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getSeasonPassAddress } from "@/utils/addresses";
import { getMaxLayer } from "@/utils/settlement";
import { getOffchainRealm, unpackValue } from "@bibliothecadao/eternum";
import { RealmInterface, ResourcesIds } from "@bibliothecadao/types";
import { gql } from "graphql-request";
import { useEffect, useMemo, useState } from "react";
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

export const SeasonPassRealm = ({
  seasonPassRealm,
  selected,
  setSelected,
  className,
  onSelectLocation,
  occupiedLocations = [],
}: {
  seasonPassRealm: SeasonPassRealm;
  selected: boolean;
  setSelected: (selected: boolean) => void;
  className?: string;
  onSelectLocation?: (realmId: number, location: SettlementLocation | null) => void;
  occupiedLocations?: SettlementLocation[];
}) => {
  const resourcesProduced = seasonPassRealm.resourceTypesUnpacked;
  const [maxLayers, setMaxLayers] = useState<number | null>(null); // Default to null
  const [realmCount, setRealmCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const maxLayer = getMaxLayer(realmCount);
    setMaxLayers(maxLayer);
  }, [realmCount]);

  useEffect(() => {
    const fetchRealmCount = async () => {
      setIsLoading(true);
      const count = await queryRealmCount();
      setRealmCount(count ?? 0);
      setIsLoading(false);
    };
    fetchRealmCount();
  }, []);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const handleLocationSelect = (location: SettlementLocation) => {
    if (onSelectLocation) {
      onSelectLocation(seasonPassRealm.realmId, location);
    }
  };

  const handleCancelLocation = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent onClick

    if (onSelectLocation && seasonPassRealm.selectedLocation) {
      // Pass null to indicate cancellation
      onSelectLocation(seasonPassRealm.realmId, null);
    }
  };

  const handleConfirmLocation = () => {
    toggleModal(null); // Close the modal
  };

  const handleSelectLocationClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent onClick
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

  return (
    <div
      key={seasonPassRealm.realmId}
      className={`flex flex-col gap-2 p-4 h-[200px] panel-wood rounded-md bg-dark-wood transition-colors duration-200 ${
        selected ? "border-gold/40 bg-black/80" : "border-transparent"
      } ${className} border hover:border-gold cursor-pointer`}
      onClick={() => setSelected(!selected)}
    >
      <div className="flex flex-row items-center gap-2 justify-between">
        <h5 className="font-semibold text-gold">{seasonPassRealm.name}</h5>
        <div className="flex items-center self-start pt-1">
          {selected ? (
            <CheckboxChecked className="w-6 h-6 fill-current text-gold" />
          ) : (
            <CheckboxUnchecked className="w-6 h-6 fill-current text-gold" />
          )}
        </div>
      </div>
      <div className="flex gap-2 z-10 items-end">
        {resourcesProduced.map((resourceId) => (
          <ResourceIcon
            className=""
            resource={ResourcesIds[resourceId]}
            size="lg"
            key={resourceId}
            withTooltip={false}
          />
        ))}
      </div>

      <div className="mt-auto border-t border-gold/20 pt-2">
        {normalizedSelectedLocation ? (
          <div className="flex flex-col gap-1">
            <h6 className="text-xs text-gold/70">Selected Location</h6>
            <div className="flex justify-between items-center">
              <h5 className="">
                ({normalizedSelectedLocation.x}, {normalizedSelectedLocation.y})
              </h5>
              <div className="flex gap-2">
                <Button onClick={handleCancelLocation} variant="danger" className="!p-1">
                  <span className="text-lg leading-none">✕</span>
                </Button>
                <Button onClick={handleSelectLocationClick} isLoading={isLoading} variant="primary" className="!p-1">
                  <MapIcon className="w-4 h-4 fill-current" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button isPulsing={true} onClick={handleSelectLocationClick} variant="primary" size="md" className="w-full">
            <div className="flex items-center justify-center gap-2">
              <MapIcon className="w-4 h-4 fill-current" />
              <div>Select Location</div>
            </div>
          </Button>
        )}
      </div>
    </div>
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
