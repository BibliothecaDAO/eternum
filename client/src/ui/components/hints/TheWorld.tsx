import { Headline } from "@/ui/elements/Headline";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";

export const TheWorld = () => {
  const concepts = [
    {
      name: "It's time to build the hyperstructures",
      content:
        "The world is a vast place, and you are a small part of it. You must build your empire and expand your influence. You can do this by building structures and armies.",
    },
  ];

  return (
    <div>
      <Headline>Key Concepts</Headline>

      {concepts.map((concept) => (
        <div key={concept.name}>
          <h2>{concept.name}</h2>
          <p className="text-xl">{concept.content}</p>
        </div>
      ))}
    </div>
  );
};
