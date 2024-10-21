import { AnimatedGrid } from "./animated-grid";
import { SeasonPass, SeasonPassProps } from "./season-pass";

interface SeasonPassRowProps {
  seasonPasses: SeasonPassProps[];
}

export const SeasonPassRow = ({ seasonPasses }: SeasonPassRowProps) => {
  return (
    <AnimatedGrid
      items={seasonPasses}
      renderItem={(seasonPass, index) => <SeasonPass key={`${seasonPass.title}-${index}`} {...seasonPass} />}
    />
  );
};
