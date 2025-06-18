import { Headline } from "@/ui/design-system/molecules/headline";

export const Guilds = () => {
  return (
    <div className="space-y-8">
      <Headline>Guilds</Headline>

      <section className="space-y-4">
        <h4>Tribes</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            Tribes are groups of players that work together to achieve common goals. Tribes can be created by any player
            and can have any number of members. Being part of a tribe is essential to success in Eternum.
          </p>
          <p className="leading-relaxed">
            A tribe can be either public or private. Anyone can join a public tribe, but only the owner of a private
            tribe can invite other players.
          </p>
        </div>
      </section>
    </div>
  );
};
