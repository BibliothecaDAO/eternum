import { HudPanel } from "@/ui/design-system/kit/hud-elements";
import { Headline } from "@/ui/design-system/molecules/headline";

export const Trading = () => {
  return (
    <div className="space-y-8">
      <Headline>Trading</Headline>

      <section className="space-y-4">
        <h4>Marketplace</h4>
        <div className="space-y-4">
          <p className="leading-relaxed">
            Trading in Realms is primarily conducted at the marketplace. This is where players can buy and sell the
            resources they generate. Just like transfers, these will require donkeys.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h4>AMM</h4>
        <div className="space-y-4">
          <HudPanel collapsible={false}>
            <div className="mb-4">
              <h5 className="mb-2 text-hud-strong">Swap</h5>
              <p className="leading-relaxed">
                The marketplace allows you to exchange resources for Lords tokens and vice versa. The exchange rate and
                potential slippage depend on the current liquidity in the market. When liquidity is low, you may need to
                accept a higher slippage to complete your trade.
              </p>
            </div>
            <div>
              <h5 className="mb-2 text-hud-strong">Liquidity</h5>
              <p className="leading-relaxed">
                You can provide liquidity to the marketplace by depositing resources and Lords tokens. This helps
                maintain a stable trading environment and ensures sufficient trading volume. As a liquidity provider,
                you'll earn a portion of the trading fees, proportional to your share of the liquidity pool.
              </p>
            </div>
          </HudPanel>
        </div>
      </section>
    </div>
  );
};
