import { currencyFormat } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";


export const TokenBalance = ({
  balance,
  symbol,
  isLoading,
  onClick,
}: {
  balance: bigint | number | string;
  symbol: string;
  isLoading?: boolean;
  onClick?: () => void;
}) => {
  const [balanceState, setBalanceState] = useState<bigint | number | string>();
  useEffect(() => {
    setBalanceState(balance);
  }, [balance]);
  return (
    <div
      onClick={onClick}
      onKeyDown={onClick} // Added to support keyboard interactions
      role="button" // Added to make div function as a button
      tabIndex={0} // Added to make the div focusable
      className="h-full cursor-pointer justify-center text-end"
    >
      <div className="flex justify-end">
        <div className="flex text-sm">
          <span className="text-sm text-white/50 pr-1">Balance:</span>

          {isLoading ?? typeof balanceState != "bigint" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : balanceState ? (
            currencyFormat(Number(balanceState), 3)
              .toLocaleString()
              .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
          ) : (
            "0"
          )}
          <div className="ml-2">{symbol}</div>
        </div>
        {/*<RefreshIcon
            size={RefreshIconSize.SMALL}
            onClick={onRefreshClick}
    />*/}
      </div>
    </div>
  );
};