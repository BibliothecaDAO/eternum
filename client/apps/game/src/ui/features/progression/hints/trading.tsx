import { Headline } from "@/ui/elements/headline";

export const Trading = () => {
  return (
    <div className="space-y-8">
      <Headline>Trading</Headline>

      <section className="space-y-4">
        <h4>Marketplace</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            Trading in Eternum is primarily conducted at the marketplace. This is where players can buy and sell the
            resources they generate. Just like transfers, these will require donkeys.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h4>AMM</h4>
        <div className="space-y-4 text-gray-200">
          <div className="rounded-lg border border-gold/20 overflow-hidden p-4 bg-gold/5">
            <div className="mb-4">
              <h5 className="font-bold mb-2">Swap</h5>
              <p className="leading-relaxed">
                The marketplace allows you to exchange resources for Lords tokens and vice versa. The exchange rate and
                potential slippage depend on the current liquidity in the market. When liquidity is low, you may need to
                accept a higher slippage to complete your trade.
              </p>
            </div>
            <div>
              <h5 className="font-bold mb-2">Liquidity</h5>
              <p className="leading-relaxed">
                You can provide liquidity to the marketplace by depositing resources and Lords tokens. This helps
                maintain a stable trading environment and ensures sufficient trading volume. As a liquidity provider,
                you'll earn a portion of the trading fees, proportional to your share of the liquidity pool.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
