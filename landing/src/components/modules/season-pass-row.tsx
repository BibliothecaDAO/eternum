import { AnimatedGrid } from "./animated-grid";
import { SeasonPass } from "./season-pass";

export interface SeasonPassData {
  title: string;
  description: string;
}

interface SeasonPassRowProps {
  seasonPasses: SeasonPassData[];
}

export const SeasonPassRow = ({ seasonPasses }: SeasonPassRowProps) => {
  const gridItems = seasonPasses.map((pass) => ({
    colSpan: { sm: 6, md: 4, lg: 3 },
    data: pass,
  }));

  return <AnimatedGrid<SeasonPassData> items={gridItems} renderItem={(item) => <SeasonPass {...item.data} />} />;
};
