import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { seasonPassAddress } from "@/config";
import { useMintSeasonPass } from "@/hooks/useMintSeasonPass";
import { useCall } from "@starknet-react/core";
import { useState } from "react";
import { Uint256, uint256 } from "starknet";
import { Button } from "../ui/button";

import { formatEther } from "viem";
import abi from "../../../../season_pass/contracts/target/release/esp_EternumSeasonPass.contract_class.json";

export interface SeasonPass {
  title: string;
  description: string;
  checked?: boolean;
  owner?: string;
  name?: string;
}

export const SeasonPass = ({ title, description, checked: initialChecked, owner, name }: SeasonPass) => {
  const [isChecked, setIsChecked] = useState(initialChecked);

  const handleCardClick = () => {
    const newCheckedState = !isChecked;
    setIsChecked(newCheckedState);
  };

  const { attachLords } = useMintSeasonPass();

  const {
    data,
    // error,
    isLoading: isLordsBalanceLoading,
  } = useCall({
    abi: abi.abi,
    functionName: "lords_balance",
    address: seasonPassAddress,
    args: [uint256.bnToUint256(name ?? "0")],
    watch: true,
    refetchInterval: 1000,
  });

  const [input, setInput] = useState("0");
  const [isLoading, setIsLoading] = useState(false);

  const attachLordsHandler = async () => {
    setIsLoading(true);

    try {
      await attachLords(Number(title), Number(input) * 10 ** 18);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      onClick={handleCardClick}
      className={`cursor-pointer transition-all duration-200 hover:border-gold ${isChecked ? "border-gold" : ""}`}
    >
      <CardHeader>
        <CardTitle className="flex justify-between items-center gap-2 text-2xl">
          <span>#{title}</span>
          <span>{owner}</span>

          {/* <Checkbox checked={isChecked} /> */}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          Balance{" "}
          {isLordsBalanceLoading ? <div>loading</div> : <div>{formatEther(uint256.uint256ToBN(data as Uint256))}</div>}
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button>Attach Lords</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle className="text-gold text-3xl text-center">Attach Lords to Realm #{title}</DialogTitle>
            <DialogDescription className="text-center">
              These will become the starting balance for your season pass. You can sell the Season Pass NFT at any time
              which will include these lords.
            </DialogDescription>

            <div className="flex items-center gap-2">
              {isLoading ? (
                <div>loading</div>
              ) : (
                <>
                  {" "}
                  <Input type="text" placeholder="0.0" value={input} onChange={(e) => setInput(e.target.value)} />
                  <Button onClick={attachLordsHandler}>Attach Lords</Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
