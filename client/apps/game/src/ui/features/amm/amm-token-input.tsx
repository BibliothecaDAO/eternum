import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { memo } from "react";

export interface TokenOption {
  address: string;
  name: string;
}

interface AmmTokenInputProps {
  amount: number;
  onAmountChange: (amount: number) => void;
  token: string;
  onTokenChange: (address: string) => void;
  balance: string;
  tokens: TokenOption[];
  label: string;
  readOnly?: boolean;
}

export const AmmTokenInput = memo(
  ({ amount, onAmountChange, token, onTokenChange, balance, tokens, label, readOnly = false }: AmmTokenInputProps) => {
    return (
      <div className="w-full bg-gold/10 rounded-xl p-3">
        <div className="text-xs text-gold/60 mb-1">{label}</div>
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <NumberInput
              className="text-2xl border-transparent"
              value={amount}
              onChange={onAmountChange}
              arrows={false}
              allowDecimals
              disabled={readOnly}
            />
          </div>

          <Select value={token} onValueChange={onTokenChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select token" />
            </SelectTrigger>
            <SelectContent>
              {tokens.map((t) => (
                <SelectItem key={t.address} value={t.address}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex text-xs mt-1 items-center text-gold/60">
          <span>Balance: {balance}</span>
          {!readOnly && (
            <button
              className="ml-2 text-gold hover:text-gold/80 cursor-pointer"
              onClick={() => {
                const parsed = parseFloat(balance);
                if (!isNaN(parsed)) {
                  onAmountChange(parsed);
                }
              }}
            >
              Max
            </button>
          )}
        </div>
      </div>
    );
  },
);

AmmTokenInput.displayName = "AmmTokenInput";
