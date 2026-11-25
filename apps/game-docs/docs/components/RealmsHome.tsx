import BRAND from "../brand.gen.json";
import { SEASON_ONE_CALENDAR } from "../utils/season-calendar";
import { firstLinkOf, gameSections } from "../utils/sidebar-tree";

export function RealmsHome() {
  const games = gameSections();

  return (
    <div className="docs-realms-home">
      <section className="docs-home-section" aria-label="Games">
        <div className="docs-home-kicker">Games</div>
        <div className="docs-game-grid">
          {games.map((game) => (
            <div key={game.id} className="docs-game-card">
              <div className="docs-game-card-body">
                <div className="docs-game-card-head">
                  <img src={BRAND.marks.lockups[game.id]} alt={game.text} className="docs-game-lockup" />
                  <span className="docs-game-badge">Season 1 · Opens {SEASON_ONE_CALENDAR.seasonStart}</span>
                </div>
                <p className="docs-game-summary">{game.summary}</p>
              </div>
              <div className="docs-game-actions">
                <a href={firstLinkOf(game)} className="docs-btn-primary">
                  Open {game.text} docs
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
