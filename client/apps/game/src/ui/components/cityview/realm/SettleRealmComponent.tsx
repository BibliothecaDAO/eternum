import { ReactComponent as CheckboxChecked } from "@/assets/icons/checkbox-checked.svg";
import { ReactComponent as CheckboxUnchecked } from "@/assets/icons/checkbox-unchecked.svg";

import { useDojo } from "@/hooks/context/DojoContext";
import { RealmInfo, usePlayerRealms } from "@/hooks/helpers/useRealm";
import Button from "@/ui/elements/Button";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { unpackResources } from "@/ui/utils/packedData";
import { getRealm } from "@/ui/utils/realms";
import { RealmInterface, ResourcesIds } from "@bibliothecadao/eternum";
import { gql } from "graphql-request";
import { useEffect, useState } from "react";
import { addAddressPadding } from "starknet";
import { env } from "../../../../../env";

const SettleRealmComponent = ({ setSettledRealmId }: { setSettledRealmId: (id: number) => void }) => {
  const {
    account: { account },
    setup: {
      systemCalls: { create_multiple_realms },
    },
  } = useDojo();

  const [loading, setLoading] = useState<boolean>(false);
  const [selectedRealms, setSelectedRealms] = useState<number[]>([]);

  const [seasonPassRealms, setSeasonPassRealms] = useState<SeasonPassRealm[]>([]);

  const settleRealms = async (realmIds: number[]) => {
    setLoading(true);
    try {
      const res = await create_multiple_realms({
        realm_ids: realmIds,
        owner: account.address,
        frontend: env.VITE_PUBLIC_CLIENT_FEE_RECIPIENT,
        signer: account,
        season_pass_address: env.VITE_SEASON_PASS_ADDRESS,
      });
    } catch (error) {
      console.error("Error settling realms:", error);
      setLoading(false);
    }
  };

  const realms = usePlayerRealms();

  useEffect(() => {
    getUnusedSeasonPasses(account.address, realms).then((unsettledSeasonPassRealms) => {
      if (unsettledSeasonPassRealms.length !== seasonPassRealms.length) {
        setSeasonPassRealms(unsettledSeasonPassRealms);
        setLoading(false);
      }
    });
  }, [loading, realms]);

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
        <div className="flex flex-col gap-2 overflow-x-auto no-scrollbar min-h-[25vh] max-h-[35vh]">
          {seasonPassRealms.map((realm) => (
            <SeasonPassRealm
              key={realm.realmId}
              seasonPassRealm={realm}
              selected={selectedRealms.includes(realm.realmId)}
              setSelected={(selected) =>
                setSelectedRealms(
                  selected ? [...selectedRealms, realm.realmId] : selectedRealms.filter((id) => id !== realm.realmId),
                )
              }
              className={`col-start-1`}
            />
          ))}
        </div>
        <div className="flex flex-row justify-center">
          <Button variant="primary" size="md" disabled={loading} onClick={() => settleRealms(selectedRealms)}>
            {loading ? <img src="/images/eternum-logo_animated.png" className="invert w-6 h-4" /> : "settle"}
          </Button>
        </div>
      </div>
    </div>
  );
};

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
  return balances?.tokenBalances?.edges
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
    .filter(
      (realm: SeasonPassRealm): realm is SeasonPassRealm =>
        realm !== undefined && realms.every((r) => r.realmId !== Number(realm.realmId)),
    )
    .sort(
      (a: SeasonPassRealm, b: SeasonPassRealm) =>
        Number(b.resourceTypesUnpacked.length) - Number(a.resourceTypesUnpacked.length),
    );
};
