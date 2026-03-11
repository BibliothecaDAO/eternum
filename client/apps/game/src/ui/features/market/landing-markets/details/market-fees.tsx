import { ClauseBuilder, ToriiQueryBuilder } from "@dojoengine/sdk";
import { useEffect, useState } from "react";

import { CoreSettings, CurveRange, MarketModelVault } from "@/pm/bindings";
import { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { formatUnits } from "@/pm/utils";
import { Card, CardContent, CardHeader, CardTitle, HStack } from "@pm/ui";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";

const settingsQuery = new ToriiQueryBuilder()
  .addEntityModel("pm-CoreSettings")
  .withClause(new ClauseBuilder().keys(["pm-CoreSettings"], ["0"]).build())
  .includeHashedKeys();

// Added 'defaultOpen' prop. If not provided, defaults to true (open by default).
interface MarketFeesProps {
  market: MarketClass;
  defaultOpen?: boolean;
}

export const MarketFees = ({ market, defaultOpen = true }: MarketFeesProps) => {
  const { sdk } = useDojoSdk();
  const [settings, setSettings] = useState<CoreSettings>();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [timer, setTimer] = useState(0);

  // Safely unwrap model - may be undefined if data not available from SQL query
  const marketModelVault = market.model?.unwrap?.() as MarketModelVault | undefined;
  const curveLinear = marketModelVault?.fee_curve?.unwrap?.() as CurveRange | undefined;

  useEffect(() => {
    const id = setInterval(() => setTimer(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const allSettings = (await sdk.getEntities({ query: settingsQuery })).getItems();
        setSettings(allSettings?.[0]?.models?.pm?.CoreSettings as CoreSettings);
      } catch (err) {
        console.error("[MarketFees] Failed to fetch settings", err);
      }
    };
    void fetchSettings();
  }, [sdk]);

  const modelFees = market.getModelFees(timer || market.start_at * 1_000);
  const totalFees =
    BigInt(settings?.protocol_fee || 0) +
    BigInt(market.oracle_fee || 0) +
    BigInt(market.creator_fee || 0) +
    BigInt(modelFees);

  if (!settings) return null;
  if (!curveLinear) return null;

  const totalLabel = `${formatUnits(totalFees, 2, 2)}%`;

  return (
    <Card className="w-full rounded-md border border-gold/15 bg-brown/45 p-3 shadow-inner">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="market-fees-panel"
      >
        <CardHeader className="flex w-full flex-row items-center justify-between px-0 py-1">
          <CardTitle className="text-sm font-semibold text-lightest">
            <HStack className="items-center gap-3">
              <span className="text-xs text-gold/80">Fees</span>
              <span className="rounded-full bg-gold/10 px-2 py-[2px] text-sm font-semibold text-gold">
                Total {totalLabel}
              </span>
            </HStack>
          </CardTitle>
          <ChevronDown className={`h-4 w-4 text-gold transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </CardHeader>
      </button>

      {isOpen ? (
        <CardContent id="market-fees-panel" className="space-y-2 px-0 pb-1 text-xs text-gold/80">
          <div className="flex items-center justify-between rounded-sm bg-brown/45 px-3 py-2">
            <span>Protocol</span>
            <span className="text-lightest">{formatUnits(settings.protocol_fee, 2, 2)}%</span>
          </div>
          <div className="flex items-center justify-between rounded-sm bg-brown/45 px-3 py-2">
            <span>Oracle</span>
            <span className="text-lightest">{formatUnits(market.oracle_fee, 2, 2)}%</span>
          </div>
          <div className="flex items-center justify-between rounded-sm bg-brown/45 px-3 py-2">
            <span>Creator</span>
            <span className="text-lightest">{formatUnits(market.creator_fee, 2, 2)}%</span>
          </div>
          <div className="flex items-center justify-between rounded-sm bg-brown/45 px-3 py-2">
            <span>
              Vault ({formatUnits(curveLinear.start, 2, 2)}% → {formatUnits(curveLinear.end, 2, 2)}%)
            </span>
            <span className="text-lightest">{formatUnits(modelFees, 2, 2)}%</span>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
};
