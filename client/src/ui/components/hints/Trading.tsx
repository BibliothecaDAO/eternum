import { Headline } from "@/ui/elements/Headline";
import { tableOfContents } from "./utils";

export const Trading = () => {
  const concepts = [
    {
      name: "Marketplace",
      content: (
        <p>
          Trading in Eternum is primarily conducted at the marketplace. This is where players can buy and sell the
          resources they generate. Just like transfers, these will require donkeys.
        </p>
      ),
    },
    {
      name: "AMM",
      content: (
        <div>
          <h3>Swap</h3>
          <p>
            The marketplace allows you to exchange resources for Lords tokens and vice versa. The exchange rate and
            potential slippage depend on the current liquidity in the market. When liquidity is low, you may need to
            accept a higher slippage to complete your trade.
          </p>
          <h3>Liquidity</h3>
          <p>
            You can provide liquidity to the marketplace by depositing resources and Lords tokens. This helps maintain a
            stable trading environment and ensures sufficient trading volume. As a liquidity provider, you'll earn a
            portion of the trading fees, proportional to your share of the liquidity pool.
          </p>
        </div>
      ),
    },
  ];

  const conceptNames = concepts.map((concept) => concept.name);

  return (
    <>
      <Headline>Trading</Headline>
      {tableOfContents(conceptNames)}

      {concepts.map((concept) => (
        <div key={concept.name}>
          <h2 id={concept.name}>{concept.name}</h2>
          {concept.content}
        </div>
      ))}
    </>
  );
};
