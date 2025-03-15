import { ReactComponent as CheckboxChecked } from "@/assets/icons/checkbox-checked.svg";
import { ReactComponent as CheckboxUnchecked } from "@/assets/icons/checkbox-unchecked.svg";
import { ReactComponent as MapIcon } from "@/assets/icons/common/map.svg";
import { useModalStore } from "@/hooks/store/use-modal-store";
import { Position } from "@/types/position";
import { SettlementMinimapModal } from "@/ui/components/settlement/settlement-minimap-modal";
import { SettlementLocation } from "@/ui/components/settlement/settlement-types";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getSeasonPassAddress } from "@/utils/addresses";
import { getMaxLayer } from "@/utils/settlement";
import { getOffchainRealm, RealmInfo, RealmInterface, ResourcesIds, unpackValue } from "@bibliothecadao/eternum";
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
  const { toggleModal } = useModalStore();

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
      className={`flex flex-col gap-3 p-3 h-[180px] rounded-md bg-black/70 transition-colors duration-200 border border-2 ${
        selected ? "border-gold bg-black/80" : "border-transparent"
      } ${className} hover:border-gold`}
      onClick={() => setSelected(!selected)}
    >
      <div className="flex flex-row items-center gap-3">
        <div className="flex items-center">
          {selected ? (
            <CheckboxChecked className="w-6 h-6 fill-current text-gold" />
          ) : (
            <CheckboxUnchecked className="w-6 h-6 fill-current text-gold" />
          )}
        </div>
        <div className="align-bottom text-base">{seasonPassRealm.name}</div>
      </div>
      <div className="grid grid-cols-7 gap-1 z-10 align-bottom items-end">
        {resourcesProduced.map((resourceId) => (
          <ResourceIcon resource={ResourcesIds[resourceId]} size="sm" key={resourceId} withTooltip={false} />
        ))}
      </div>

      <div className="mt-auto">
        {normalizedSelectedLocation ? (
          <div className="flex flex-col gap-1">
            <div className="text-sm text-gold/80">Selected Location:</div>
            <div className="flex justify-between items-center">
              <div className="text-base">
                {normalizedSelectedLocation.x}, {normalizedSelectedLocation.y}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCancelLocation}
                  className="!h-8 !w-8 !min-w-0 !p-0 !bg-red-500/30 !text-red-400 rounded-md hover:!bg-red-500/40"
                >
                  <span className="text-sm">✕</span>
                </Button>
                <Button
                  onClick={handleSelectLocationClick}
                  isLoading={isLoading}
                  className="!h-8 !w-8 !min-w-0 !p-0 !bg-gold/30 !text-gold rounded-md hover:!bg-gold/40"
                >
                  <MapIcon className="w-5 h-5 fill-current" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button
            onClick={handleSelectLocationClick}
            className="w-full !h-[40px] !bg-gold/30 !text-gold !normal-case rounded-md hover:!bg-gold/40 text-sm"
          >
            <div className="flex items-center justify-center">
              <MapIcon className="w-5 h-5 mr-2 fill-current" />
              <div className="!font-normal">Select Location</div>
            </div>
          </Button>
        )}
      </div>
    </div>
  );
};

export const getUnusedSeasonPasses = async (accountAddress: string, realms: RealmInfo[]) => {
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
        realm !== undefined && realms.every((r) => r.realmId !== Number(realm.realmId)),
    )
    .sort(
      (a: SeasonPassRealm, b: SeasonPassRealm) =>
        Number(b.resourceTypesUnpacked.length) - Number(a.resourceTypesUnpacked.length),
    );
};
