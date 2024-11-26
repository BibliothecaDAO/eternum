import Button from "../../../elements/Button";

import { useMintedRealms } from "@/hooks/helpers/use-minted-realms";
import { useSettleRealm } from "@/hooks/helpers/use-settle-realm";
import { useEntities } from "@/hooks/helpers/useEntities";
import { MAX_REALMS } from "@/ui/constants";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/Collapsible";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ChevronsUpDown } from "lucide-react";

const SettleRealmComponent = ({ setSettledRealmId }: { setSettledRealmId: (id: number) => void }) => {
  const { playerRealms } = useEntities();

  const { settleRealm, isLoading, tokenId, setTokenId, errorMessage } = useSettleRealm();

  const mintedRealms = useMintedRealms();

  const numberRealms = Math.max(mintedRealms, playerRealms().length);

  return (
    <>
      <div className="flex flex-col h-min">
        <div className="flex flex-col gap-y-1 md:gap-y-2">
          <h2 className=" text-center">Settle Realms</h2>

          {numberRealms >= MAX_REALMS ? (
            <p className="text-center md:text-xl text-xs">You have already settled the maximum number of Realms.</p>
          ) : (
            <p className="text-center md:text-xl text-xs">
              Settle a maximum of 4 Realms. Select a Realm ID or a random one.
            </p>
          )}

          <div className="flex flex-wrap gap-2 my-1 md:my-3">
            {playerRealms().map((realm) => (
              <div className="border border-gold/20 rounded p-2" key={realm.realm_id}>
                {realm.name}
              </div>
            ))}
          </div>

          {numberRealms < MAX_REALMS && (
            <Button
              variant={"primary"}
              onClick={async () => {
                const realmId = await settleRealm();
                if (realmId) {
                  setSettledRealmId(realmId);
                }
              }}
            >
              {isLoading ? "Loading..." : "Settle Random Realm"}
            </Button>
          )}

          {numberRealms < MAX_REALMS && (
            <>
              <h3 className="text-center">or</h3>

              <Collapsible className="space-y-2 w-full">
                <CollapsibleTrigger asChild>
                  <Button variant={"outline"} className="w-full">
                    <span>Select Realm</span>
                    <ChevronsUpDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 border p-2 rounded border-gold/20">
                  <div className="flex justify-center gap-1 md:gap-4 py-1 md:py-4">
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
            </>
          )}
        </div>
        {errorMessage && <p className="text-center text-red font-bold py-2">{errorMessage}</p>}
      </div>
    </>
  );
};

export default SettleRealmComponent;
