import Button from "../../../elements/Button";

import { useSettleRealm } from "@/hooks/helpers/use-settle-realm";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/Collapsible";
import { NumberInput } from "@/ui/elements/NumberInput";
import { useQuery } from "@tanstack/react-query";
import request, { gql } from "graphql-request";
import { ChevronsUpDown } from "lucide-react";

export const GET_REALMS = gql`
  query getRealms($accountAddress: String!) {
    ercBalance(accountAddress: $accountAddress) {
      balance
      type
      tokenMetadata {
        tokenId
        contractAddress
      }
    }
  }
`;

export const GET_ERC_MINTS = gql`
  query getRealmMints {
    ercTransfer(accountAddress: "0x0", limit: 8000) {
      tokenMetadata {
        tokenId
        contractAddress
      }
    }
  }
`;

const SettleRealmComponent = () => {
  const { data: realmMints } = useQuery({
    queryKey: ["realmMints"],
    queryFn: async () =>
      await request(
        import.meta.env.VITE_PUBLIC_TORII + "/graphql",
        GET_ERC_MINTS,
        {},
        // variables are type-checked too!
      ),
  });

  const { settleRealm, isLoading, tokenId, setTokenId, errorMessage } = useSettleRealm();

  return (
    <>
      <div className="flex flex-col h-min">
        <div className="flex flex-col gap-y-2">
          <h2 className=" text-center">Settle Realms</h2>
          <p className="text-center text-xl">Settle a maximum of 4 Realms. Select a Realm ID or a random one.</p>

          <Button
            variant={"primary"}
            onClick={async () => {
              await settleRealm();
            }}
          >
            {isLoading ? "Loading..." : "Settle Random Realm"}
          </Button>

          <h3 className="text-center">or</h3>

          <Collapsible className="space-y-2 w-full">
            <CollapsibleTrigger asChild>
              <Button variant={"outline"} className="w-full">
                <span>Select Realm</span>
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 border p-2 rounded border-gold/20">
              <div className="flex justify-center gap-4 py-4">
                <div className="text-lg text-muted-foreground uppercase justify-self-start text-center self-center font-bold">
                  Realm ID
                </div>
                <NumberInput
                  className="  font-bold self-center !w-32"
                  max={8000}
                  min={1}
                  value={tokenId}
                  onChange={setTokenId}
                />
                <Button
                  isLoading={isLoading}
                  onClick={async () => (!isLoading ? await settleRealm(tokenId) : null)}
                  className="text-xl self-center"
                  variant={"primary"}
                >
                  {!isLoading ? "Settle Realms" : ""}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        {errorMessage && <p className="text-center text-red-500 py-2">{errorMessage}</p>}
      </div>
    </>
  );
};

export default SettleRealmComponent;
