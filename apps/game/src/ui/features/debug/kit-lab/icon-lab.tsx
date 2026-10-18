import { useState } from "react";
import { Icon } from "@/ui/design-system/icon";
import { iconDefinition, iconMeanings, type IconMeaning } from "@/ui/design-system/icon-meaning";
import { ActionTile } from "@/ui/features/world/containers/left-facets/structure-actions-panel";
import { Button } from "@/ui/design-system/kit/button";
import { RealmLevelIcons, RealmHexFillComparison } from "./realm-level-icons";
import { IconMinimap } from "./icon-minimap";
import "./icon-lab.css";
const families = [...new Set(iconMeanings.map((name) => iconDefinition(name).family))];
export function IconLab() {
  const [size, setSize] = useState(32);
  const [family, setFamily] = useState("All");
  const [search, setSearch] = useState("");
  const [labels, setLabels] = useState(true);
  const [action, setAction] = useState("Choose an action to inspect its meaning.");
  const shown = iconMeanings.filter(
    (name) =>
      (family === "All" || iconDefinition(name).family === family) &&
      `${name} ${iconDefinition(name).label}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <main className="icon-lab" data-art="facets" data-hidden={!labels}>
      <header>
        <h1>Facets icons</h1>
        <p>
          Production artwork at actual HUD sizes. Utilities use Ivory relief; resources keep their paintings and LORDS
          its official mark. Every meaning uses the same renderer as the game.
        </p>
      </header>
      <RealmHexFillComparison />
      <RealmLevelIcons />
      <div className="icon-controls">
        <fieldset>
          <legend>Size</legend>
          {[24, 32, 64].map((pixels) => (
            <button key={pixels} data-size={pixels} aria-pressed={size === pixels} onClick={() => setSize(pixels)}>
              {pixels} px
            </button>
          ))}
        </fieldset>
        <label>
          Family{" "}
          <select aria-label="Icon family" value={family} onChange={(event) => setFamily(event.target.value)}>
            {["All", ...families].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Find <input aria-label="Find icon" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <button id="labels" aria-pressed={!labels} onClick={() => setLabels(!labels)}>
          {labels ? "Hide labels" : "Show labels"}
        </button>
      </div>
      <section aria-label="Action meanings">
        <div className="icon-controls">
          {(["build", "production", "military", "transfer", "trade"] as const).map((id) => (
            <ActionTile
              key={id}
              action={{
                id,
                label: iconDefinition(id).label,
                active: false,
                refusal: null,
                onClick: () => setAction(`${iconDefinition(id).label} selected`),
              }}
            />
          ))}
          {(["move", "settings"] satisfies IconMeaning[]).map((name) => (
            <Button
              key={name}
              role="secondary"
              word={iconDefinition(name).label}
              icon={name}
              onClick={() => setAction(`${iconDefinition(name).label} selected`)}
            />
          ))}
        </div>
        <p role="status">{action}</p>
      </section>
      <IconMinimap />
      <p>{shown.length} meanings</p>
      <div className="icon-cards">
        {shown.map((name) => (
          <article className="icon-card frontier-card" key={name} data-meaning={name}>
            <div className="icon-canvas">
              <Icon name={name} size={size} alt={labels ? iconDefinition(name).label : "Unlabelled icon"} />
            </div>
            {labels && <h4>{iconDefinition(name).label}</h4>}
          </article>
        ))}
      </div>
    </main>
  );
}
