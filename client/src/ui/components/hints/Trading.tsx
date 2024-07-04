import { Headline } from "@/ui/elements/Headline";
import { tableOfContents } from "./utils";

export const Trading = () => {
  const chapters = [
    {
      title: "Marketplace",
      content:
        "Trading in Eternum is primarily conducted at the marketplace. This is where players can buy and sell the resources they generate. Just like transfers, these will require donkeys.",
    },
    {
      title: "AMM",
      content: (
        <ul>
          <li>
            <h3>Swap</h3>
            <p>
              The marketplace allows you to exchange resources for Lords tokens and vice versa. The exchange rate and
              potential slippage depend on the current liquidity in the market. When liquidity is low, you may need to
              accept a higher slippage to complete your trade.
            </p>
          </li>
          <li>
            <h3>Liquidity</h3>
            <p>
              You can provide liquidity to the marketplace by depositing resources and Lords tokens. This helps maintain
              a stable trading environment and ensures sufficient trading volume. As a liquidity provider, you'll earn a
              portion of the trading fees, proportional to your share of the liquidity pool.
            </p>
          </li>
        </ul>
      ),
    },
  ];

  const chapterTitles = chapters.map((chapter) => chapter.title);

  return (
    <>
      <Headline>Trading</Headline>
      {tableOfContents(chapterTitles)}

      {chapters.map((chapter) => (
        <div key={chapter.title}>
          <h2 id={chapter.title}>{chapter.title}</h2>
          {chapter.content}
        </div>
      ))}
    </>
  );
};
