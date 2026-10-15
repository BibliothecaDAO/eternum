import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/ui/design-system/kit/button";
import { KitIconArt, type IconCode } from "@/ui/design-system/kit/kit-icon";
import { PriceChip } from "@/ui/design-system/kit/price-chip";
import { OrderBar } from "@/ui/features/frontier/hud/order-bar";
import catalog from "../../../../../asset-sources/icon-study-painted/catalog.json";
import verdicts from "../../../../../asset-sources/icon-study-painted/verdicts.json";
import { iconArt } from "./icon-art";
import { IconMinimap } from "./icon-minimap";
import "./icon-lab.css";

const { icons, directions } = catalog;
const families = [...new Set(icons.map((icon) => icon.family))];
const samples: Partial<Record<IconCode, string>> = {
  Es: "essence",
  La: "labor",
  Wh: "wheat",
  Tr: "knight-t2",
  St: "stamina",
  Ey: "explore",
  Bt: "move",
  At: "attack",
  Sd: "paladin-t2",
  Ch: "chest",
  Cp: "camp",
  Cs: "realm",
  Ct: "chat",
  Tp: "victory",
};

export function IconLab() {
  const [query, setQuery] = useSearchParams();
  const requested = query.get("art");
  const direction = directions.some((item) => item.id === requested) ? requested! : "shipped";
  const [size, setSize] = useState(32);
  const [hidden, setHidden] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [reading, setReading] = useState("");
  const [readings, setReadings] = useState<{ icon: string; direction: string; observed: string; intended: string }[]>(
    [],
  );
  const [action, setAction] = useState("Select an order to try its live controls.");
  const [order, setOrder] = useState<"explore" | "move">("explore");
  const [stamina, setStamina] = useState(90);
  const [wheat, setWheat] = useState(2400);
  const art =
    direction === "shipped"
      ? {}
      : Object.fromEntries(Object.entries(samples).map(([code, id]) => [code, iconArt(direction, id!, 32)]));
  const comparison = direction === "shipped" ? directions : directions.filter((item) => item.id === direction);
  const review = verdicts as Record<string, { verdict: string; reason: string }>;
  const name = direction === "shipped" ? "Shipped" : directions.find((item) => item.id === direction)!.name;
  const renderFamily = (family: string) => (
    <section key={family} data-family={family}>
      <h3>{family}</h3>
      <div className="icon-cards">
        {comparison.flatMap((option) =>
          icons
            .filter((icon) => icon.family === family)
            .map((icon) => {
              const verdict = review[`${option.id}/${icon.id}`];
              if (!verdict || verdict.verdict === "worse") return null;
              return (
                <article
                  className="icon-card frontier-card"
                  key={`${option.id}/${icon.id}`}
                  data-icon={icon.id}
                  data-direction={option.id}
                >
                  <h4 className="icon-meaning">{icon.label}</h4>
                  <div className="icon-pair">
                    {["shipped", option.id].map((variant) => (
                      <div key={variant}>
                        <div className="icon-canvas">
                          <img
                            width={size}
                            height={size}
                            style={{ width: size, height: size }}
                            src={iconArt(variant, icon.id, size)}
                            alt={
                              hidden
                                ? "Unlabelled icon"
                                : `${variant === "shipped" ? "Shipped" : option.name} ${icon.label}`
                            }
                          />
                        </div>
                        <small>{variant === "shipped" ? "Shipped" : option.name}</small>
                      </div>
                    ))}
                  </div>
                  <p className="icon-meaning icon-verdict">{verdict.verdict}</p>
                  <p className="icon-meaning icon-reason">{verdict.reason}</p>
                  <button
                    className="read-icon"
                    onClick={() => {
                      setSelected(`${option.id}/${icon.id}`);
                      setReading("");
                    }}
                  >
                    Read this icon
                  </button>
                </article>
              );
            }),
        )}
      </div>
    </section>
  );
  return (
    <main className="icon-lab" data-art={direction} data-hidden={hidden}>
      <header>
        <h1>Painted icons</h1>
        <p>Facets · nine soldier portraits and hex minimap badges. Compare with shipped art at actual display sizes.</p>
      </header>
      <div className="icon-controls">
        <fieldset>
          <legend>Art in the live components</legend>
          {[{ id: "shipped", name: "Shipped" }, ...directions].map((item) => (
            <button
              key={item.id}
              data-art-choice={item.id}
              aria-pressed={direction === item.id}
              onClick={() => setQuery({ art: item.id })}
            >
              {item.name}
            </button>
          ))}
        </fieldset>
        <fieldset>
          <legend>Comparison size</legend>
          {[24, 32, 64].map((pixels) => (
            <button key={pixels} data-size={pixels} aria-pressed={size === pixels} onClick={() => setSize(pixels)}>
              {pixels} px
            </button>
          ))}
        </fieldset>
        <button id="labels" aria-pressed={hidden} onClick={() => setHidden(!hidden)}>
          {hidden ? "Show labels" : "Hide labels"}
        </button>
      </div>
      {renderFamily("Troops")}
      <div className="icon-stage">
        <section className="icon-live frontier-card">
          <h2>{name} · live kit</h2>
          <KitIconArt.Provider value={art}>
            <div className="icon-stores">
              <PriceChip of="wheat" amount={wheat} />
              <PriceChip of="labor" amount={840} />
              <PriceChip of="essence" amount={120} />
              <PriceChip of="stamina" amount={stamina} />
            </div>
            <div className="icon-orders">
              <Button role="secondary" word="Move order" icon="Bt" onClick={() => setOrder("move")} />
              <Button role="secondary" word="Explore order" icon="Ey" onClick={() => setOrder("explore")} />
            </div>
            <div className="icon-order-bar">
              <OrderBar
                kind={order}
                tiles={order === "move" ? 3 : 1}
                stamina={{ cost: 30, held: stamina, wait: undefined }}
                wheat={{ cost: 100, held: wheat, wait: undefined }}
                revealYield={50}
                xp={12}
                onCancel={() => setAction("Order cancelled.")}
                onGo={() => {
                  setStamina((value) => value - 30);
                  setWheat((value) => value - 100);
                  setAction(`${order === "move" ? "Move" : "Explore"} confirmed · 30 stamina and 100 wheat spent.`);
                }}
              />
            </div>
          </KitIconArt.Provider>
          <p id="action-result" role="status">
            {action}
          </p>
          <button
            onClick={() => {
              setStamina(90);
              setWheat(2400);
              setAction("Fixture reset.");
            }}
          >
            Reset fixture
          </button>
        </section>
        <section>
          <h2>Minimap · ownership and values</h2>
          <IconMinimap direction={direction} />
        </section>
      </div>
      <section className="icon-catalog">
        <h2>Shipped beside each replacement</h2>
        {families.filter((family) => family !== "Troops").map(renderFamily)}
      </section>
      {selected && (
        <section className="icon-reading">
          <h2>What do you see?</h2>
          <button id="close-reading" onClick={() => setSelected(undefined)}>
            Done reading
          </button>
          <img
            width={64}
            height={64}
            src={iconArt(selected.split("/")[0], selected.split("/")[1])}
            alt="Unlabelled selected icon"
          />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (reading.trim())
                setReadings([
                  ...readings,
                  {
                    icon: selected.split("/")[1],
                    direction: selected.split("/")[0],
                    observed: reading,
                    intended: icons.find((icon) => icon.id === selected.split("/")[1])!.label,
                  },
                ]);
            }}
          >
            <label>
              Your reading{" "}
              <input id="reading" value={reading} onChange={(event) => setReading(event.target.value)} required />
            </label>
            <button id="reveal">Reveal meaning</button>
          </form>
          <ol id="readings">
            {readings.map((item, index) => (
              <li key={index}>
                {item.observed} → {item.intended} ({item.direction})
              </li>
            ))}
          </ol>
          <button
            id="download"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(readings, null, 2)], { type: "application/json" }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = "painted-icon-readings.json";
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Download readings
          </button>
        </section>
      )}
      <footer>
        Art verdicts are editorial comparisons at 24, 32 and 64 px. Fixture values are illustrative. The selected art
        applies only within this lab view.
      </footer>
    </main>
  );
}
