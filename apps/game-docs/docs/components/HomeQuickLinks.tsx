import { APP_ADDRESS } from "../../../game/src/config/app-address";
import { leavesForKind, quickLinksForGame, startLinkForGame, type GameId } from "../utils/sidebar-tree";

export function HomeQuickLinks({ game }: { game: GameId }) {
  const items = quickLinksForGame(game);
  const startHref = startLinkForGame(game);
  const dashboard = leavesForKind("data")[0];
  return (
    <div className="docs-frontier-landing-nav">
      <div className="docs-game-actions">
        <a href={startHref} className="docs-btn-primary">
          Start here
        </a>
        <a href={APP_ADDRESS} className="docs-btn-outline">
          Play
        </a>
        {dashboard ? (
          <a href={dashboard.link} className="docs-btn-outline">
            {dashboard.text}
          </a>
        ) : null}
      </div>
      <nav className="docs-home-quick docs-frontier-quick" aria-label="Game catalogs">
        {items.map((item) => (
          <a key={item.link} href={item.link}>
            {item.text}
          </a>
        ))}
      </nav>
    </div>
  );
}
