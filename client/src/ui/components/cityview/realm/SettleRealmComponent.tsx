import { useDojo } from "@/hooks/context/DojoContext";
import Button from "@/ui/elements/Button";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { unpackResources } from "@/ui/utils/packedData";
import { getRealm } from "@/ui/utils/realms";
import { RealmInterface, ResourcesIds } from "@bibliothecadao/eternum";
import { gql } from "graphql-request";
import { useEffect, useMemo, useState } from "react";
import { addAddressPadding } from "starknet";
import { env } from "../../../../../env";

const SettleRealmComponent = ({ setSettledRealmId }: { setSettledRealmId: (id: number) => void }) => {
  const {
    account: { account },
    setup: {
      systemCalls: { create_multiple_realms },
    },
  } = useDojo();

  const [selectedRealms, setSelectedRealms] = useState<number[]>([]);

  const [seasonPassRealms, setSeasonPassRealms] = useState<SeasonPassRealm[]>([]);

  const settleRealms = async (realmIds: number[]) => {
    await create_multiple_realms({
      realm_ids: realmIds,
      owner: account.address,
      frontend: "0x0",
      signer: account,
    });
  };

  useEffect(() => {
    const getSeasonPasses = async () => {
      const balances = await querySeasonPasses(account.address);
      const seasonPassNfts = balances?.tokenBalances?.edges
        ?.filter(
          (token: { node: { tokenMetadata: { __typename: string; contractAddress?: string } } }) =>
            token?.node?.tokenMetadata.__typename == "ERC721__Token" &&
            addAddressPadding(token.node.tokenMetadata.contractAddress ?? "0x0") ===
              addAddressPadding(env.VITE_SEASON_PASS_ADDRESS ?? "0x0"),
        )
        .map((token: { node: { tokenMetadata: { tokenId: string } } }) => {
          const realmsResourcesPacked = getRealm(Number(token.node.tokenMetadata.tokenId));
          if (!realmsResourcesPacked) return undefined;
          return {
            ...realmsResourcesPacked,
            resourceTypesUnpacked: unpackResources(realmsResourcesPacked.resourceTypesPacked),
          };
        })
        .filter((realm: SeasonPassRealm): realm is SeasonPassRealm => Boolean(realm))
        .sort(
          (a: SeasonPassRealm, b: SeasonPassRealm) =>
            Number(b.resourceTypesUnpacked.length) - Number(a.resourceTypesUnpacked.length),
        );
      setSeasonPassRealms(seasonPassNfts);
    };
    getSeasonPasses();
  }, []);

  const seasonPassElements = useMemo(() => {
    let realms = [];
    for (let i = 0; i < seasonPassRealms.length; i += 2) {
      realms.push(
        <div className={`grid grid-rows-2 gap-4 mr-4`}>
          <SeasonPassRealm
            seasonPassRealm={seasonPassRealms[i]}
            selected={selectedRealms.includes(seasonPassRealms[i].realmId)}
            setSelected={(selected) =>
              setSelectedRealms(
                selected
                  ? [...selectedRealms, seasonPassRealms[i].realmId]
                  : selectedRealms.filter((id) => id !== seasonPassRealms[i].realmId),
              )
            }
            className={`row-start-1`}
          />
          {seasonPassRealms[i + 1] && (
            <SeasonPassRealm
              seasonPassRealm={seasonPassRealms[i + 1]}
              selected={selectedRealms.includes(seasonPassRealms[i + 1].realmId)}
              setSelected={(selected) =>
                setSelectedRealms(
                  selected
                    ? [...selectedRealms, seasonPassRealms[i + 1].realmId]
                    : selectedRealms.filter((id) => id !== seasonPassRealms[i + 1].realmId),
                )
              }
              className={`row-start-2`}
            />
          )}
        </div>,
      );
    }
    return realms;
  }, [seasonPassRealms, selectedRealms, setSelectedRealms]);

  return (
    <div className="flex flex-col h-min">
      <div className="flex flex-col gap-y-1 md:gap-y-2">
        <h2 className="text-center">Settle Realms</h2>
        <div>
          <Button
            className="text-xxs"
            variant="primary"
            size="xs"
            onClick={() =>
              setSelectedRealms(selectedRealms.length > 0 ? [] : seasonPassRealms.map((realm) => realm.realmId))
            }
          >
            {selectedRealms.length > 0 ? "unselect all" : "select all"}
          </Button>
        </div>
        <div className="flex flex-row overflow-y-auto no-scrollbar">{seasonPassElements}</div>
        <div className="flex flex-row justify-center">
          <Button className="text-xxs" variant="primary" size="xs" onClick={() => settleRealms(selectedRealms)}>
            settle
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettleRealmComponent;

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

type SeasonPassRealm = RealmInterface & {
  resourceTypesUnpacked: number[];
};

const SeasonPassRealm = ({
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

  console.log(seasonPassRealm.realmId, selected);
  return (
    <div
      key={seasonPassRealm.realmId}
      className={`flex flex-col justify-between gap-2 border-4 p-2 rounded-md ${
        selected ? "border-gold bg-gold/30" : "border-gold/10"
      } min-h-[10vh] max-h-[10vh] min-w-[15.8vw] max-w-[15.8vw] ${className}`}
      onClick={() => setSelected(!selected)}
    >
      <div className="flex flex-col">{seasonPassRealm.name}</div>
      <div className="flex flex-col text-xs font-bold truncate">
        <div className={`flex flex-row items-center border-1 rounded-md p-2 border-gold/10`}>
          <div className={`text-gold text-xs`}>
            <div className={`font-semibold mb-2 text-xxs`}>Produces</div>
            <div className="flex flex-row flex-wrap mb-4">
              {resourcesProduced.map((resourceId) => (
                <ResourceIcon resource={ResourcesIds[resourceId]} size="xs" key={resourceId} withTooltip={false} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
