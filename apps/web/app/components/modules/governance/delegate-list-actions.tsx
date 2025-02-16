import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCurrentDelegate } from "@/hooks/governance/use-current-delegate";
import { useDelegateRealms } from "@/hooks/governance/use-delegate-realms";
import { useStarkDisplayName } from "@/hooks/use-stark-name";
import { useAccount } from "@starknet-react/core";
import { Shuffle, TrendingDown } from "lucide-react";
import { num } from "starknet";

export interface DelegateListActionsProps {
  onSortChange?: (sortMethod: "desc" | "random") => void;
}

export function DelegateListActions({
  onSortChange,
}: DelegateListActionsProps) {
  const { address } = useAccount();
  const { sendAsync: delegateRealms } = useDelegateRealms({
    delegatee: address,
  });
  const { data: currentDelegate } = useCurrentDelegate();

  const name = useStarkDisplayName(
    num.toHex(currentDelegate ?? "") as `0x${string}`,
  );

  // New state for sort/filter method
  const [sortMethod, setSortMethod] = useState<"desc" | "random">("random");

  const toggleSortMethod = () => {
    // Toggle sort method and notify the parent via the onSortChange callback
    setSortMethod((prevMethod) => {
      const newMethod = prevMethod === "desc" ? "random" : "desc";
      if (onSortChange) {
        onSortChange(newMethod);
      }
      return newMethod;
    });
  };

  return (
    <div className="flex flex-col items-center gap-2 px-2 text-center sm:flex-row">
      {currentDelegate ? (
        <>
          <Label className="text-muted-foreground text-xs">Delegate:</Label>
          <Badge className="mr-2 rounded-full" variant={"outline"}>
            {name}
          </Badge>
        </>
      ) : (
        address && (
          <Button onClick={() => delegateRealms()}>Delegate to self</Button>
        )
      )}
      <Button variant="outline" onClick={toggleSortMethod}>
        {sortMethod === "desc" ? (
          <>
            <TrendingDown className="mr-2 h-4 w-4" />
            Desc votes
          </>
        ) : (
          <>
            <Shuffle className="mr-2 h-4 w-4" />
            Random
          </>
        )}
      </Button>
    </div>
  );
}
