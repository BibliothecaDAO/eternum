import { ClauseBuilder, ToriiQueryBuilder } from "@dojoengine/sdk";
import { useEffect, useMemo, useState } from "react";

import { CoreSettings, CurveRange, MarketModelVault } from "@/pm/bindings";
import { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/useDojoSdk";
import { formatUnits } from "@/pm/utils";
import { Card, CardContent, CardHeader, CardTitle, HStack } from "@pm/ui";
import { ChevronDown } from "lucide-react";

const settingsQuery = new ToriiQueryBuilder()
  .addEntityModel("pm-CoreSettings")
  .withClause(new ClauseBuilder().keys(["pm-CoreSettings"], ["0"]).build())
  .includeHashedKeys();

export const MarketFees = ({ market }: { market: MarketClass }) => {
  const { sdk } = useDojoSdk();
  const [settings, setSettings] = useState<CoreSettings>();
  const [isOpen, setIsOpen] = useState(true);
  const [timer, setTimer] = useState(0);

  const marketModelVault = market.model.unwrap() as MarketModelVault;
  const curveLinear = marketModelVault.fee_curve.unwrap() as CurveRange;

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

  const modelFees = useMemo(() => {
    return market.getModelFees(Date.now());
  }, [market, timer]);

  const totalFees = useMemo(() => {
    return (
      BigInt(settings?.protocol_fee || 0) +
      BigInt(market?.oracle_fee || 0) +
      BigInt(market?.creator_fee || 0) +
      BigInt(modelFees)
    );
  }, [modelFees, market?.creator_fee, market?.oracle_fee, settings?.protocol_fee]);

  if (!settings) return null;
  if (!curveLinear) return null;

  const totalLabel = `${formatUnits(totalFees, 2, 2)}%`;

  return (
    <Card className="w-full rounded-md border border-white/10 bg-white/5 p-3 shadow-inner">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="market-fees-panel"
      >
        <CardHeader className="flex w-full flex-row items-center justify-between px-0 py-1">
          <CardTitle className="text-sm font-semibold text-white">
            <HStack className="items-center gap-3">
              <span className="text-xs text-gold/80">Fees</span>
              <span className="rounded-full bg-white/10 px-2 py-[2px] text-[10px] font-semibold text-gold">
                Total {totalLabel}
              </span>
            </HStack>
          </CardTitle>
          <ChevronDown className={`h-4 w-4 text-gold transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </CardHeader>
      </button>

      {isOpen ? (
        <CardContent id="market-fees-panel" className="space-y-2 px-0 pb-1 text-xs text-gold/80">
          <div className="flex items-center justify-between rounded-sm bg-white/5 px-3 py-2">
            <span>Protocol</span>
            <span className="text-white">{formatUnits(settings.protocol_fee, 2, 2)}%</span>
          </div>
          <div className="flex items-center justify-between rounded-sm bg-white/5 px-3 py-2">
            <span>Oracle</span>
            <span className="text-white">{formatUnits(market.oracle_fee, 2, 2)}%</span>
          </div>
          <div className="flex items-center justify-between rounded-sm bg-white/5 px-3 py-2">
            <span>Creator</span>
            <span className="text-white">{formatUnits(market.creator_fee, 2, 2)}%</span>
          </div>
          <div className="flex items-center justify-between rounded-sm bg-white/5 px-3 py-2">
            <span>
              Vault ({formatUnits(curveLinear.start, 2, 2)}% → {formatUnits(curveLinear.end, 2, 2)}%)
            </span>
            <span className="text-white">{formatUnits(modelFees, 2, 2)}%</span>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
};
