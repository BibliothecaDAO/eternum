import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";

/**
 * The one Blitz waiting screen, in the shell and at game entry alike: the launch service settles the roster's realms,
 * and play opens once every player on the roster has theirs.
 */
export const BlitzPreparing = ({ game, member }: { game: HeraldGameDirectoryEntry; member: boolean }) => {
  const settled = Math.min(game.player_count, game.roster_count);
  const progress = game.roster_count > 0 ? (settled / game.roster_count) * 100 : 0;
  return (
    <div role="status" className="space-y-2 text-sm text-gold/80">
      <p>
        {member ? "Your realms are being prepared." : "The roster's realms are being prepared."} Play opens once every
        player on the roster has their realms.
      </p>
      {game.roster_count > 0 ? (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-brown/50">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-gold/70">
            {settled} / {game.roster_count} players settled
          </div>
        </>
      ) : null}
    </div>
  );
};
