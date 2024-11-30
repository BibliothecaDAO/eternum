import { SeasonPass } from "@/components/modules/season-pass";
import { SeasonPassRow } from "@/components/modules/season-pass-row";
import { TypeH1 } from "@/components/typography/type-h1";
import { seasonPassAddress } from "@/config";
import { execute } from "@/hooks/gql/execute";
import { GET_ERC_MINTS } from "@/hooks/query/realms";
import { shortenHex } from "@dojoengine/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

export const Route = createLazyFileRoute("/passes")({
  component: Passes,
});

function Passes() {
  const { data: seasonPassMints } = useSuspenseQuery({
    queryKey: ["ERCMints"],
    queryFn: () => execute(GET_ERC_MINTS),
    refetchInterval: 10_000,
  });

  const parseTokenId = (tokenId: string) => {
    return parseInt(tokenId, 16).toString();
  };

  const seasonPassTokens: SeasonPass[] = useMemo(
    () =>
      seasonPassMints?.ercTransfer
        ?.filter((token) => token?.tokenMetadata.contractAddress === seasonPassAddress)
        .map((token) => ({
          title: parseTokenId(token?.tokenMetadata.tokenId || ""),
          description: "",
          owner: shortenHex(token?.tokenMetadata.contractAddress || ""),
          name: parseTokenId(token?.tokenMetadata.tokenId || ""),
        })) || [],
    [seasonPassMints],
  );

  console.log(seasonPassTokens);

  return (
    <div className="flex flex-col h-full">
      <TypeH1>Season Passes</TypeH1>

      {/* <div className="sticky top-0 z-10">
        <AttributeFilters />
      </div> */}
      <div className="flex-grow overflow-y-auto">
        <div className="flex flex-col gap-2">
          <SeasonPassRow seasonPasses={seasonPassTokens} />
        </div>
      </div>
      {/* <div className="flex justify-end border border-gold/15 p-4 rounded-xl mt-4 sticky bottom-0 bg-brown gap-8">
        <TypeH2>10 Selected</TypeH2>
        <Button variant="cta">Buy a Season Pass</Button>
      </div> */}
    </div>
  );
}
