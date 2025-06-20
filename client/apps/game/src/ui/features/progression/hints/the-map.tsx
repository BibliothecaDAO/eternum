import { Headline } from "@/ui/design-system/molecules/headline";
import { ExplorationTable } from "@/ui/features/progression";

export const TheMap = () => {
  return (
    <div className="space-y-8">
      <Headline>The Map</Headline>

      <section className="space-y-4">
        <h4>Exploration</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            The world map starts unexplored, except for Realms. Exploring new tiles with your armies costs food and
            reveals hidden lands, potentially yielding random resources or uncovering valuable fragment mines.
          </p>
        </div>
        <ExplorationTable />
      </section>

      <section className="space-y-4">
        <h4>Biomes</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">{/* Content for biomes will be added here */}</p>
        </div>
      </section>
    </div>
  );
};
