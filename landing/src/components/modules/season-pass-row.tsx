import { SeasonPass } from "./season-pass";

const seasonPasses = [
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
];

export const SeasonPassRow = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ">
      {seasonPasses.map((seasonPass) => (
        <SeasonPass key={seasonPass.title} {...seasonPass} />
      ))}
    </div>
  );
};
