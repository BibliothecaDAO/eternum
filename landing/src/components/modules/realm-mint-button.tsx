import { useMintTestRealm } from "@/hooks/useMintTestRealm";
import { Loader } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export const RealmMintButton = ({ highestTokenId }: { highestTokenId?: number }) => {
  const [tokenId, setTokenId] = useState('');

  const { mint: mintRealm, isMinting } = useMintTestRealm();
  const onMintRealm = async () => {
    if (mintRealm) {
      mintRealm(Number(tokenId ?? (highestTokenId ?? 0) + 1));
      setTokenId('')
    }
  };
  return (
    <div className="flex">
      <Input placeholder="Add ID" className="!bg-brown w-20" max={8000} min={1} value={tokenId} onChange={(e) => setTokenId(Number(e.target.value))} />
      <Button disabled={!tokenId} variant={"outline"} onClick={() => onMintRealm()}>
       {isMinting && <Loader className="animate-spin pr-2"/>} Mint a Realm
      </Button>
    </div>
  );
};
