import { ResourceIcon } from "@/ui/elements/resource-icon";

export const TheWorld = () => {
  const chapters = [
    {
      title: "Time to Build",
      icon: <ResourceIcon size="xl" resource="Ancient Fragment" />,
      content:
        "You have been chosen to lead your people to greatness. You must build your empire, forge alliances, and conquer your enemies. Only the strong will survive.",
    },
    {
      title: "The Hyperstructures",
      content:
        "Long before recorded history, the Ancients constructed vast hyperstructures to harness the energies of the cosmos. These colossal edifices, buried and forgotten, hold the key to untold power. As the world awakens, it becomes clear that the fragments of these hyperstructures are scattered across the land, each containing a piece of their ancient might. ",
    },

    {
      title: "Your Mission",

      content:
        "Your mission is to explore the world, uncover the fragments, and harness their power to build your empire. As you build, you will attract the attention of other players, who will seek to ally with you or challenge your rule. The world is vast and full of danger, but with the right strategy, you can rise to the top and become the most powerful ruler in Eternum.",
    },
  ];

  return (
    <div>
      {chapters.map((chapter) => (
        <div key={chapter.title}>
          {chapter?.icon}
          <h2>{chapter.title}</h2>
          <p>{chapter.content}</p>
        </div>
      ))}
    </div>
  );
};
