import { execute } from "@/hooks/gql/execute";
import { GET_REALM_MINTS } from "@/hooks/query/realms";
import { useMintTestRealm } from "@/hooks/useMintTestRealm";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Loader } from "lucide-react";
import { useMemo, useState } from "react";
import { TypeH2 } from "../typography/type-h2";
import { TypeH3 } from "../typography/type-h3";
import { TypeP } from "../typography/type-p";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export const RealmMintDialog = ({
  isOpen,
  setIsOpen,
  totalOwnedRealms,
}: {
  highestTokenId?: number;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  totalOwnedRealms?: number;
}) => {
  const { data, isLoading } = useSuspenseQuery({
    queryKey: ["RealmMints"],
    queryFn: () => execute(GET_REALM_MINTS),
    //enabled: !!account?.address,
    refetchInterval: 10_000,
  });

  // Create an array of realm tokenIds
  const filteredRealmTokenIds = useMemo(() => {
    return data?.ercTransfer
      ?.filter((item) => item?.tokenMetadata.contractAddress.toLowerCase() === import.meta.env.VITE_REALMS_ADDRESS)
      .map((item) => Number(item?.tokenMetadata.tokenId));
  }, [data]);

  const generateUniqueRandomNumbers = (count: number, min: number, max: number, exclude: number[]): number[] => {
    const uniqueNumbers = new Set<number>();
    const excludeSet = new Set(exclude);

    if (max - min + 1 - exclude.length < count) {
      throw new Error("Not enough unique numbers available.");
    }

    while (uniqueNumbers.size < count) {
      const rand = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!excludeSet.has(rand)) {
        uniqueNumbers.add(rand);
      }
    }
    return Array.from(uniqueNumbers);
  };

  const randomIds = useMemo(() => {
    return generateUniqueRandomNumbers(10, 1, 8000, filteredRealmTokenIds || []);
  }, [filteredRealmTokenIds]);

  const [tokenId, setTokenId] = useState("");

  const { mint: mintRealm, isMinting } = useMintTestRealm();
  const onMintRealm = async (tokenId?: string) => {
    if (!tokenId) {
      const random = generateUniqueRandomNumbers(1, 1, 8000, filteredRealmTokenIds || []);
      tokenId = random[0].toString();
    }
    if (mintRealm) {
      mintRealm(Number(tokenId));
      setTokenId("");
      setIsOpen(false);
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="justify-normal text-primary lg:justify-center"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">Mint Realms</DialogTitle>

        {totalOwnedRealms && totalOwnedRealms >= 4 ? (
          <TypeP>You have reached the maximum of 4 Realms and can not mint any more</TypeP>
        ) : (
          <div className="flex flex-col text-center items-center">
            <div className="flex flex-col gap-y-2">
              <TypeH2 className="border-b-0 text-center">Mint Realms</TypeH2>
              <TypeP>Mint a maximum of 4 Realms (which you can then mint a Season Pass from each)</TypeP>

              <Button onClick={() => onMintRealm()}>
                {isMinting && <Loader className="animate-spin pr-2" />} Mint Random Realm
              </Button>

              <TypeH3>or</TypeH3>

              <Collapsible className="space-y-2 w-full">
                <CollapsibleTrigger asChild>
                  <Button variant={"outline"} className="w-full">
                    <span>Select Realm</span>
                    <ChevronsUpDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 border p-2">
                  <Label className="text-sm text-muted-foreground uppercase justify-self-start">Random Realms</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {randomIds.map((randomRealm) => (
                      <Button onClick={() => setTokenId(randomRealm.toString())} variant={"outline"}>
                        {randomRealm}
                      </Button>
                    ))}
                  </div>
                  <div className="flex pt-8 justify-center">
                    <Input
                      placeholder="Add ID"
                      className="!bg-brown w-20"
                      max={8000}
                      min={1}
                      value={tokenId}
                      onChange={(e) => setTokenId(e.target.value)}
                    />
                    <Button disabled={!tokenId} onClick={() => onMintRealm()}>
                      {isMinting && <Loader className="animate-spin pr-2" />} Mint Realm
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
