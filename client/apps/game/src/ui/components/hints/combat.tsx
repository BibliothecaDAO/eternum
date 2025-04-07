import { Headline } from "@/ui/elements/headline";
import { configManager } from "@bibliothecadao/eternum";

export const Combat = () => {
  const troopConfig = configManager.getTroopConfig();

  return (
    <div className="space-y-8">
      <Headline>Combat</Headline>

      <section className="space-y-4">
        <h4>Combat System</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            Work in progress, this section will be updated soon. Combat includes systems for protecting your structures,
            exploration mechanics, battles, and troop management.
          </p>
        </div>
      </section>
    </div>
  );
};

const Strength = ({
  strength,
  strongAgainst,
  weakAgainst,
  advantagePercent,
  disadvantagePercent,
}: {
  strength: number;
  strongAgainst: string;
  weakAgainst: string;
  advantagePercent: number;
  disadvantagePercent: number;
}) => {
  return (
    <div className="flex flex-col">
      <div>
        + {advantagePercent}% vs {strongAgainst}
      </div>
      <div>
        - {disadvantagePercent}% vs {weakAgainst}
      </div>
    </div>
  );
};
