export const Guilds = () => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Tribes</h2>
        <p className="text-muted-foreground text-sm">Unite with other players for greater power</p>
      </div>

      <div className="space-y-6">
        <div className="p-4 rounded-lg bg-muted/30">
          <h3 className="text-lg font-semibold mb-3 text-primary">Strength in Unity</h3>
          <p className="text-sm leading-relaxed text-foreground/90">
            Form or join Tribes to coordinate strategies, share resources, and wage wars together. Tribal cooperation is
            essential for controlling Hyperstructures and achieving victory in Eternum.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/30">
          <h3 className="text-lg font-semibold mb-3 text-primary">Tribal Warfare</h3>
          <p className="text-sm leading-relaxed text-foreground/90">
            Organize coordinated attacks, defend allied territories, and compete against rival Tribes for dominance. The
            most successful Tribes combine military might with diplomatic cunning.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/30">
          <h3 className="text-lg font-semibold mb-3 text-primary">Shared Victory</h3>
          <p className="text-sm leading-relaxed text-foreground/90">
            When a Tribe member wins the season, all members share in the glory. Work together to build and control
            Hyperstructures, pooling resources and expertise to achieve collective success.
          </p>
        </div>
      </div>
    </div>
  );
};
