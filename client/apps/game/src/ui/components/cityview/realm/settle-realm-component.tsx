import { ReactComponent as CheckboxChecked } from "@/assets/icons/checkbox-checked.svg";
import { ReactComponent as CheckboxUnchecked } from "@/assets/icons/checkbox-unchecked.svg";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getSeasonPassAddress } from "@/utils/addresses";
import { getOffchainRealm, RealmInfo, RealmInterface, ResourcesIds, unpackValue } from "@bibliothecadao/eternum";
import { gql } from "graphql-request";
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
};

export const SeasonPassRealm = ({
  seasonPassRealm,
  selected,
  setSelected,
  className,
}: {
  seasonPassRealm: SeasonPassRealm;
  selected: boolean;
  setSelected: (selected: boolean) => void;
  className?: string;
}) => {
  const resourcesProduced = seasonPassRealm.resourceTypesUnpacked;

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
