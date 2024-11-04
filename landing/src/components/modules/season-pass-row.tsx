import { AnimatedGrid } from "./animated-grid";
import { SeasonPass } from "./season-pass";

interface SeasonPassRowProps {
  seasonPasses: SeasonPass[];
}

export const SeasonPassRow = ({ seasonPasses }: SeasonPassRowProps) => {
  return (
    <AnimatedGrid
      items={seasonPasses}
      renderItem={(seasonPass, index) => <SeasonPass key={`${seasonPass.title}-${index}`} {...seasonPass} />}
    />
  );
};
