import { ResourceIcon } from "@/ui/elements/ResourceIcon";

export const TheWorld = () => {
  const chapters = [
    {
      title: "Awakening the Ancients",
      icon: <ResourceIcon size="xl" resource="Ancient Fragment" />,
      content:
        "Long before recorded history, the Ancients constructed vast hyperstructures to harness the energies of the cosmos. These colossal edifices, buried and forgotten, hold the key to untold power. As the world awakens, it becomes clear that the fragments of these hyperstructures are scattered across the land, each containing a piece of their ancient might. ",
    },
    {
      title: "Time to Build",
      content:
        "You, a visionary leader, must embark on a quest to gather these fragments. Through exploration, cunning, and strength, you will uncover these relics of the past. Each fragment you collect brings you closer to rebuilding the magnificent hyperstructures in their entirety.",
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
