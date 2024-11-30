import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@radix-ui/react-dialog";
import { useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

export interface SeasonPassCardProps {
  title: string;
  description: string;
  checked?: boolean;
  owner?: string;
  name?: string;
  isChecked: boolean;
  onCardClick: () => void;
  lordsBalance?: string;
  isLordsBalanceLoading: boolean;
  onAttachLords: (amount: number) => Promise<void>;
  isAttachLoading: boolean;
}

export const SeasonPassCard = ({
  title,
  description,
  owner,
  isChecked,
  onCardClick,
  lordsBalance,
  isLordsBalanceLoading,
  onAttachLords,
  isAttachLoading,
}: SeasonPassCardProps) => {
  const [input, setInput] = useState("0");

  const handleAttachLords = () => {
    onAttachLords(Number(input));
  };

  return (
    <Card
      onClick={onCardClick}
      className={`cursor-pointer transition-all duration-200 hover:border-gold ${isChecked ? "border-gold" : ""}`}
    >
      <CardHeader>
        <CardTitle className="flex justify-between items-center gap-2 text-2xl">
          <span>#{title}</span>
          <span>{owner}</span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          Balance {isLordsBalanceLoading ? <div>loading</div> : <div>{lordsBalance}</div>}
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
              {isAttachLoading ? (
                <div>loading</div>
              ) : (
                <>
                  {" "}
                  <Input type="text" placeholder="0.0" value={input} onChange={(e) => setInput(e.target.value)} />
                  <Button onClick={handleAttachLords}>Attach Lords</Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
