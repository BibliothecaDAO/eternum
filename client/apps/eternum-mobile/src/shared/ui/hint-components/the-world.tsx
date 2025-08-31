import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export const TheWorld = () => {
  const chapters = [
    {
      title: "Time to Build",
      content:
        "You have been chosen to lead your people to greatness. You must build your empire, forge alliances, and conquer your enemies. Only the strong will survive in the lands of Eternum.",
    },
    {
      title: "The Enigmatic Hyperstructures",
      content:
        "Long before recorded history, the Ancients constructed vast Hyperstructures. These colossal edifices, now found as dormant Foundations scattered across Eternum, hold the key to ultimate power and victory. Rebuilding and controlling these structures by gathering Ancient Fragments, vast amounts of resources, and labor is the primary path to winning a season. They are the ultimate strategic targets, demanding cooperation and might to secure.",
    },
    {
      title: "Forge Your Legacy in a Living World",
      content:
        "Your journey in Eternum is one of exploration, expansion, and influence. Venture into the unknown to discover vital resources, claim valuable Fragment Mines that yield Ancient Fragments, and secure Hyperstructure Foundations. Engage in a dynamic, player-driven economy where every material is produced and traded. Raise armies not just for conquest, but to defend your holdings and project your power. Form or join Tribes to cooperate, strategize, and wage wars. While the grandest glory lies in dominating Hyperstructures, Eternum offers many paths to greatness—be it through economic supremacy, military renown, or cunning diplomacy. The world is vast and full of challenges and opportunities; carve out your destiny.",
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">The World</CardTitle>
          <CardDescription>Your destiny awaits in the realm of Eternum</CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {chapters.map((chapter) => (
          <Card key={chapter.title}>
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
