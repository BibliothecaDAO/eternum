import { useState } from "react";
import { Icon } from "@/ui/design-system/icon";
import { HexMarker } from "@/ui/design-system/hex-marker";
import { realmMeaning, realmMarkerMeaning } from "@/ui/design-system/domain-icon-meaning";
import { REALM_ASSETS } from "@/three/structures/realm-design";
import references from "../../../../../asset-sources/facets/realm-model-references.json";

export function RealmLevelIcons() {
  const [option, setOption] = useState(true);
  const [size, setSize] = useState(32);
  return (
    <section id="realm-levels" aria-label="Realm level comparison" className="my-6 space-y-4">
      <h2>Realm levels</h2>
      <p className="flex items-center gap-3">
        Current generic realm <Icon name="realm" size={32} /> · Models and paintings by level
      </p>
      <div className="icon-controls">
        <fieldset>
          <legend>Realm artwork</legend>
          <button data-realm-art="shipped" aria-pressed={!option} onClick={() => setOption(false)}>
            Shipped
          </button>
          <button data-realm-art="levels" aria-pressed={option} onClick={() => setOption(true)}>
            By level
          </button>
        </fieldset>
        <fieldset>
          <legend>Realm icon size</legend>
          {[24, 32, 64].map((pixels) => (
            <button
              key={pixels}
              data-realm-size={pixels}
              aria-pressed={size === pixels}
              onClick={() => setSize(pixels)}
            >
              {pixels} px
            </button>
          ))}
        </fieldset>
      </div>
      {references.map(({ level, render }) => {
        const model = REALM_ASSETS.find((asset) => asset.level === level && !asset.wonder)!;
        return (
          <article key={level} data-realm-level={level} className="rounded border border-white/15 p-3">
            <h3 className="!mt-0">
              {level} · {model.id[0].toUpperCase() + model.id.slice(1)} — {model.label}
            </h3>
            <div className="grid grid-cols-2 items-center gap-4 md:grid-cols-4">
              <figure>
                <figcaption>Shipped model</figcaption>
                <img src={render} alt={`${model.label} model`} width={112} height={112} />
              </figure>
              <figure>
                <figcaption>Shipped level icon</figcaption>
                <img
                  data-shipped-realm={level}
                  src={`/lab/realm-level-icons/shipped-${level}.webp`}
                  alt=""
                  width={size}
                  height={size}
                  className="my-5"
                />
              </figure>
              <figure>
                <figcaption>{option ? "Facets by level" : "Shipped preview"}</figcaption>
                <div className="my-5" data-realm-preview={option ? "levels" : "shipped"}>
                  {option ? (
                    <Icon name={realmMeaning(level)} size={size} />
                  ) : (
                    <img src={`/lab/realm-level-icons/shipped-${level}.webp`} alt="" width={size} height={size} />
                  )}
                </div>
              </figure>
              <figure>
                <figcaption>Hex minimap · {option ? "by level" : "shipped"}</figcaption>
                <div className="my-4 flex flex-wrap gap-1">
                  {(["you", "ally", "enemy", "neutral"] as const).map((owner) => (
                    <svg
                      key={owner}
                      viewBox="-15 -15 30 30"
                      width={30}
                      height={30}
                      role="img"
                      aria-label={`${owner}, level ${level}`}
                    >
                      <HexMarker
                        name={option ? realmMarkerMeaning(level) : "map-realm"}
                        owner={owner}
                        value={String(level)}
                      />
                    </svg>
                  ))}
                </div>
              </figure>
            </div>
          </article>
        );
      })}
    </section>
  );
}
