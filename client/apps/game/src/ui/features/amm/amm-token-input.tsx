import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { memo } from "react";

export interface TokenOption {
  address: string;
  name: string;
  shortLabel: string;
  iconResource: string | null;
}

interface AmmTokenInputProps {
  amount: number;
  onAmountChange: (amount: number) => void;
  token: string;
  onTokenChange: (address: string) => void;
  balance?: string | null;
  tokens: TokenOption[];
  label: string;
  readOnly?: boolean;
}

const TokenGlyph = ({ iconResource, name }: { iconResource: string | null; name: string }) => {
  if (!iconResource) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-gold/10 bg-gold/10 text-[10px] font-semibold text-gold">
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-gold/10 bg-black/40">
      <ResourceIcon resource={iconResource} size="sm" withTooltip={false} className="!h-5 !w-5" />
    </div>
  );
};

export const AmmTokenInput = memo(
  ({
    amount,
    onAmountChange,
    token,
    onTokenChange,
    balance = null,
    tokens,
    label,
    readOnly = false,
  }: AmmTokenInputProps) => {
    const selectedToken = tokens.find((candidate) => candidate.address === token) ?? null;

    return (
      <div className={cn(
        "w-full rounded-2xl border border-gold/10 p-4 shadow-[0_16px_36px_-26px_rgba(0,0,0,0.95)] backdrop-blur-[10px]",
        readOnly ? "bg-black/50" : "bg-black/35"
      )}>
        <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-gold/45">{label}</div>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <NumberInput
              className={cn("h-14 rounded-2xl border border-gold/10", readOnly ? "bg-black/20 opacity-60 cursor-not-allowed" : "bg-gold/12")}
              value={amount}
              onChange={onAmountChange}
              arrows={false}
              allowDecimals
              disabled={readOnly}
            />
          </div>

          <Select value={token} onValueChange={onTokenChange}>
            <SelectTrigger className="w-auto min-w-[155px] rounded-2xl border border-gold/10 bg-black/30 px-3 py-2">
              {selectedToken ? (
                <div className="flex items-center gap-2">
                  <TokenGlyph iconResource={selectedToken.iconResource} name={selectedToken.name} />
                  <div className="flex min-w-0 flex-col text-left">
                    <span className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-gold">
                      {selectedToken.shortLabel}
                    </span>
                    <span className="truncate text-[11px] text-gold/55">{selectedToken.name}</span>
                  </div>
                </div>
              ) : (
                <SelectValue placeholder="Select token" />
              )}
            </SelectTrigger>
            <SelectContent>
              {tokens.map((t) => (
                <SelectItem key={t.address} value={t.address}>
                  <div className="flex items-center gap-2">
                    <TokenGlyph iconResource={t.iconResource} name={t.name} />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-gold">
                        {t.shortLabel}
                      </span>
                      <span className="truncate text-[11px] text-gold/55">{t.name}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {balance !== null && balance !== undefined && (
          <div className="mt-2 flex items-center text-xs text-gold/60">
            <span>Balance: {balance}</span>
            <button
              className="ml-2 cursor-pointer text-gold hover:text-gold/80"
              onClick={() => {
                const parsed = parseFloat(balance);
                if (!isNaN(parsed)) {
                  onAmountChange(parsed);
                }
              }}
            >
              Max
            </button>
          </div>
        )}
      </div>
    );
  },
);

AmmTokenInput.displayName = "AmmTokenInput";
