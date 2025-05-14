import { ReactComponent as MapIcon } from "@/assets/icons/common/map.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { CartridgeAchievement, checkAndDispatchGgXyzQuestProgress } from "@/services/gg-xyz";
import { Position } from "@/types/position";
import { SettlementMinimapModal } from "@/ui/components/settlement/settlement-minimap-modal";
import { SettlementLocation } from "@/ui/components/settlement/settlement-types";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getSeasonPassAddress } from "@/utils/addresses";
import { getOffchainRealm, unpackValue } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { RealmInterface, ResourcesIds } from "@bibliothecadao/types";
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

export const SeasonPassRealm = ({
  seasonPassRealm,
  selected,
  setSelected,
  className,
  onSelectLocation,
  occupiedLocations = [],
  realmCount,
  maxLayers,
}: {
  seasonPassRealm: SeasonPassRealm;
  selected: boolean;
  setSelected: (selected: boolean) => void;
  className?: string;
  onSelectLocation?: (realmId: number, location: SettlementLocation | null) => void;
  occupiedLocations?: SettlementLocation[];
  realmCount: number;
  maxLayers: number | null;
}) => {
  const toggleModal = useUIStore((state) => state.toggleModal);
  const resourcesProduced = seasonPassRealm.resourceTypesUnpacked;
  const [isLoading, setIsLoading] = useState(false);
  const [isSettled, setIsSettled] = useState(false);

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
    } catch (error) {
      toast.error("Error settling realms");
      console.error("Error settling realms:", error);
    } finally {
      setIsLoading(false);
      checkAndDispatchGgXyzQuestProgress(account?.address, CartridgeAchievement.REALM_SETTLEMENT);
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

  return (
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
