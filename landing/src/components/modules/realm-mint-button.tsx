import { useMintTestRealm } from "@/hooks/useMintTestRealm";
import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export const RealmMintButton = ({ highestTokenId }: { highestTokenId?: number }) => {
  const [tokenId, setTokenId] = useState<number>();

  const { mint: mintRealm, isMinting } = useMintTestRealm();
  const onMintRealm = async () => {
    if (mintRealm) {
      mintRealm(tokenId ?? (highestTokenId ?? 0) + 1);
    }
  };
  return (
    <div className="flex">
      <Input max={8000} min={1} value={tokenId} onChange={(e) => setTokenId(Number(e.target.value))} />
      <Button variant={"outline"} onClick={() => onMintRealm()}>
        Mint a Realm
      </Button>
    </div>
  );
};
