import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { configManager } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { tableOfContents } from "./utils";

export const GettingStarted = () => {
  const chapters = [
    {
      title: "Seasons & Victory",
      content:
        "Eternum is played in seasons. Each season is a fresh campaign with specific rules and victory conditions, primarily achieved by accumulating Victory Points through constructing and owning Hyperstructures. In-game assets can often be bridged forward, allowing progress to carry over between seasons.",
    },
    {
      title: "The Eternum Day",
      content: `Time in Eternum is measured in Eternum Days. An Eternum Day is exactly ${
        configManager.getTick(TickIds.Armies) / 60
      } minute(s) in the real world. Many game mechanics, like resource production and stamina regeneration, are tied to this cycle.`,
    },
    {
      title: "Realms & Villages",
      content:
        "Players start by settling a Realm (8,000 unique NFTs, requiring a Season Pass to settle) or establishing a Village around a settled Realm. Realms can be upgraded (Settlement → City → Kingdom → Empire) unlocking more buildable hexes and defensive slots, produce 1-7 resources, and can be claimed if defenses fall. Villages offer simpler entry, produce at 50% the rate of Realms (1 resource type), are tied to a parent Realm, have limited upgrades, and cannot be claimed (but can be raided).",
    },
    {
      title: "Materials: The Lifeblood of Eternum",
      content:
        "Materials are tangible, tokenized assets. Categories include: Food (Wheat, Fish - vital for production and armies), Resources (22 types, e.g., Wood, Stone, Dragonhide), Troops (units for armies), Donkeys (for transport), Labor (for 'simple mode' building/production, acquired by burning resources), and Ancient Fragments (for Hyperstructures). All materials (except Labor) can be bridged out as ERC20 tokens via Realms/Banks and have weight affecting storage and transport.",
    },
    {
      title: "Buildings & Construction",
      content:
        "Construction uses either Standard mode (resource-efficient) or Simple mode (labor-focused). Key building types: The Keep (central structure), Resource Buildings (for each of the 22 resources), Economic Buildings (Farms, Markets, etc.), and Military Buildings (for troop production). Buildings require available buildable hexes and population capacity, which increase with Realm/Village upgrades.",
    },
    {
      title: "Production Essentials",
      content:
        "Production also has Standard (resource-intensive) or Simple (food and labor) modes. Food is unique as it can be produced without inputs. Other resources require combinations of other resources or labor. Labor itself is produced by burning resources. Troops and Donkeys also require production.",
    },
    {
      title: "The World Map & Exploration",
      content:
        "Eternum unfolds on an infinite, procedurally generated hexagonal map. The world starts shrouded and is revealed through exploration by armies. The map features 16 unique biome types that affect combat and troop movement. Exploring a hex costs stamina (typically 30 per hex) and may reveal resources, world structures, or enemy agents.",
    },
    {
      title: "Trading & Transport",
      content:
        "The Lords Market facilitates trade. Donkeys are crucial for transporting materials between locations and are single-use, consumed after one journey. Banks are special world structures that can also facilitate trade. A Donkey balance is required for trading activities.",
    },
    {
      title: "Military Basics: Armies & Combat",
      content:
        "Armies consist of a single troop type (Knights, Crossbowmen, or Paladins) and tier (T1, T2, T3), with higher tiers being stronger. Combat is influenced by army damage, stamina modifiers, and biome effects. Field Armies operate on the world map for exploration and conquest, while Guard Armies defend structures. Raiding allows attempts to steal resources without fully defeating defenders.",
    },
    {
      title: "Travel & Stamina",
      content:
        "Deployed armies use stamina for movement on the map and for performing actions like attacking or exploring. Stamina regenerates partially each Eternum Day (e.g., +20). Different troop types have varying maximum stamina, and movement costs can differ by biome.",
    },
  ];

  const chapterTitles = chapters.map((chapter) => chapter.title);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Key Concepts</CardTitle>
          <CardDescription>Essential knowledge for playing Eternum</CardDescription>
        </CardHeader>
        <CardContent>{tableOfContents(chapterTitles)}</CardContent>
      </Card>

      <div className="space-y-4">
        {chapters.map((chapter) => (
          <Card key={chapter.title} id={chapter.title}>
            <CardHeader>
              <CardTitle className="text-lg">{chapter.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{chapter.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
