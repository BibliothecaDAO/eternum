import BRAND from "../brand.gen.json";
import { APP_ADDRESS } from "../../../game/src/config/app-address";
import { SEASON_ONE_CALENDAR } from "../utils/season-calendar";
import { firstLinkOf, gameSections, leavesForKind } from "../utils/sidebar-tree";

export function RealmsHome() {
  const games = gameSections();
  const globalLinks = leavesForKind("global");
  const dataLinks = leavesForKind("data");

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
                <a href={APP_ADDRESS} className="docs-btn-outline">
                  Play
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="docs-home-strips">
        <nav className="docs-home-strip" aria-label="Global">
          <div className="docs-home-kicker">Global</div>
          <div className="docs-home-pills">
            {globalLinks.map((item) => (
              <a key={item.link} href={item.link}>
                {item.text}
              </a>
            ))}
          </div>
        </nav>

        <nav className="docs-home-strip" aria-label="Data">
          <div className="docs-home-kicker">Data</div>
          <div className="docs-home-pills">
            {dataLinks.map((item) => (
              <a key={item.link} href={item.link}>
                {item.text}
              </a>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
