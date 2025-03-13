import { ReactComponent as CheckboxChecked } from "@/assets/icons/checkbox-checked.svg";
import { ReactComponent as CheckboxUnchecked } from "@/assets/icons/checkbox-unchecked.svg";
import { ReactComponent as MapIcon } from "@/assets/icons/common/map.svg";
import { useModalStore } from "@/hooks/store/use-modal-store";
import { SettlementMinimapModal } from "@/ui/components/settlement/settlement-minimap-modal";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getSeasonPassAddress } from "@/utils/addresses";
import { SettlementLocation } from "@/utils/settlement";
import { getOffchainRealm, RealmInfo, RealmInterface, ResourcesIds, unpackValue } from "@bibliothecadao/eternum";
import { gql } from "graphql-request";
import { useState } from "react";
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

export type SeasonPassRealm = RealmInterface & {
  resourceTypesUnpacked: number[];
  selectedLocation?: SettlementLocation;
};

export const SeasonPassRealm = ({
  seasonPassRealm,
  selected,
  setSelected,
  className,
  onSelectLocation,
}: {
  seasonPassRealm: SeasonPassRealm;
  selected: boolean;
  setSelected: (selected: boolean) => void;
  className?: string;
  onSelectLocation?: (realmId: number, location: SettlementLocation) => void;
}) => {
  const resourcesProduced = seasonPassRealm.resourceTypesUnpacked;
  const [maxLayers] = useState(5); // Default to 5 layers
  const { toggleModal } = useModalStore();

  const handleLocationSelect = (location: SettlementLocation) => {
    if (onSelectLocation) {
      onSelectLocation(seasonPassRealm.realmId, location);
    }
  };

  const handleConfirmLocation = () => {
    toggleModal(null); // Close the modal
  };

  const handleSelectLocationClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent onClick
    toggleModal(
      <SettlementMinimapModal
        onSelectLocation={handleLocationSelect}
        onConfirm={handleConfirmLocation}
        maxLayers={maxLayers}
        realmId={seasonPassRealm.realmId}
        realmName={seasonPassRealm.name}
      />,
    );
  };

  return (
    <div
      key={seasonPassRealm.realmId}
      className={`flex flex-col gap-2 p-2 rounded-md bg-gold/10 transition-colors duration-200 border border-2 ${
        selected ? "border-gold bg-gold/30" : "border-transparent"
      } ${className} hover:border-gold`}
      onClick={() => setSelected(!selected)}
    >
      <div className="flex flex-row items-center gap-2">
        <div className="flex items-center">
          {selected ? (
            <CheckboxChecked className="w-5 h-5 fill-current text-gold" />
          ) : (
            <CheckboxUnchecked className="w-5 h-5 fill-current text-gold" />
          )}
        </div>
        <div className="align-bottom">{seasonPassRealm.name}</div>
      </div>
      <div className="grid grid-cols-7 gap-[1px] z-10 align-bottom items-end -ml-[0.2vw]">
        {resourcesProduced.map((resourceId) => (
          <ResourceIcon resource={ResourcesIds[resourceId]} size="sm" key={resourceId} withTooltip={false} />
        ))}
      </div>

      <div className="mt-1">
        {seasonPassRealm.selectedLocation ? (
          <div className="flex flex-col">
            <div className="text-xs text-gold/80 mb-1">Selected Location:</div>
            <div className="flex justify-between items-center">
              <div className="text-sm">
                Side {seasonPassRealm.selectedLocation.side}, Layer {seasonPassRealm.selectedLocation.layer}, Point{" "}
                {seasonPassRealm.selectedLocation.point}
              </div>
              <Button
                onClick={handleSelectLocationClick}
                className="!h-6 !w-6 !min-w-0 !p-0 !bg-gold/30 !text-gold rounded-md hover:!bg-gold/40"
              >
                <MapIcon className="w-4 h-4 fill-current" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={handleSelectLocationClick}
            className="w-full !h-7 !bg-gold/30 !text-gold !normal-case rounded-md hover:!bg-gold/40 text-xs"
          >
            <div className="flex items-center justify-center">
              <MapIcon className="w-4 h-4 mr-1 fill-current" />
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
