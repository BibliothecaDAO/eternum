import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

export const Swap = () => {
  const [fromToken, setFromToken] = useState("");

  const [fromAmount, setFromAmount] = useState("");

  return (
    <div className="w-96 flex flex-col gap-3">
      <div className="flex justify-between">
        <div>From Wallet</div>
        <div>0x12340...</div>
      </div>
      <Select value={fromToken} onValueChange={(value) => setFromToken(value)}>
        <SelectTrigger className="w-full border-gold/15">
          <SelectValue placeholder="Select Realm To Transfer" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">1</SelectItem>
          <SelectItem value="dark">2</SelectItem>
          <SelectItem value="system">3</SelectItem>
        </SelectContent>
      </Select>

      <SwapRow
        fromAmount={fromAmount}
        setFromAmount={setFromAmount}
        fromToken={fromToken}
        setFromToken={setFromToken}
      />
      <div className="flex flex-col gap-1">
        <div className="flex justify-between">
          <div>Time to Transfer</div>
          <div>1hr</div>
        </div>
        <div className="flex justify-between">
          <div>Donkeys Needed</div>
          <div>50</div>
        </div>
        <hr />
        <div className="flex justify-between font-bold">
          <div>Total Transfer Fee</div>
          <div>100</div>
        </div>
        <div className="flex justify-between text-xs">
          <div>veLORDS</div>
          <div>100</div>
        </div>
        <div className="flex justify-between text-xs">
          <div>client</div>
          <div>100</div>
        </div>
      </div>

      <Button variant="cta">Initiate Transfer</Button>
    </div>
  );
};

export const SwapRow = ({
  fromAmount,
  setFromAmount,
  fromToken,
  setFromToken,
}: {
  fromAmount: string;
  setFromAmount: (value: string) => void;
  fromToken: string;
  setFromToken: (value: string) => void;
}) => {
  return (
    <div className="rounded-lg p-3 border border-gold/15 shadow-lg bg-dark-brown flex gap-3">
      <Input
        type="text"
        placeholder="0.0"
        value={fromAmount}
        onChange={(e) => setFromAmount(e.target.value)}
        className="bg-dark-brown text-2xl w-full outline-none h-16 border-none "
      />

      <Select value={fromToken} onValueChange={(value) => setFromToken(value)}>
        <SelectTrigger className="w-[180px] border-gold/15">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">Lords</SelectItem>
          <SelectItem value="dark">Diamonds</SelectItem>
          <SelectItem value="system">Ruby</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
