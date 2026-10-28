// @vitest-environment jsdom
import { ContractAddress } from "@bibliothecadao/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { plateSideStyle, type PlateWatched } from "@/three/map-plates/map-plate-model";
import { seatSide, type Side } from "@/tokens";
import { HexMarker, type MarkerOwner } from "@/ui/design-system/hex-marker";
import { campBeside, SITE } from "@/ui/features/frontier/sites/site-fixture";
import { minimapMarkersView } from "./minimap-markers";

/** The colour a minimap mark's hex frame is drawn in. */
const frameColour = (owner: MarkerOwner) =>
  /<polygon[^>]*stroke:([^;"]+)/.exec(
    renderToStaticMarkup(
      <svg>
        <HexMarker name="map-army" owner={owner} />
      </svg>,
    ),
  )?.[1];

/** The colour the map's label for the same thing is drawn in. */
const labelColour = (relation: Side, watched?: PlateWatched) =>
  (plateSideStyle({ relation, watched }) as Record<string, string>)["--mp-side"];

const watchedSeat = (seat: number | null): PlateWatched => ({ seat, colour: seatSide(seat).colour, mark: null });

describe("the minimap draws each thing in its map label's colour", () => {
  it.each(["own", "ally", "enemy", "neutral"] as const)("a %s thing, to a playing viewer", (side) => {
    expect(frameColour(side)).toBe(labelColour(side));
  });

  it.each([0, 3, 30])("a player in seat %s, to a watching viewer", (seat) => {
    expect(frameColour(`seat-${seat}`)).toBe(labelColour("enemy", watchedSeat(seat)));
  });

  it("nobody's, to a watching viewer, in grey", () => {
    expect(frameColour("nobody")).toBe(labelColour("neutral", watchedSeat(null)));
  });
});

describe("enemies are red on the minimap", () => {
  it.each([
    ["Frontier", 5, "beast-troll"],
    ["Blitz", 2, "camp"],
  ] as const)(
    "in %s, another player's realm and army and a beast's camp are red; yours are green",
    (_, preset, camp) => {
      const { store } = campBeside();
      const game = store.require("GameRegistry", { game_id: 1 });
      store.applyFacts([{ model: "GameRegistry", key: "0x3", value: { ...game, preset_id: preset } }]);
      const marks = (viewer: string) => {
        const markers = minimapMarkersView.read(store, ContractAddress(viewer));
        return ["7", "201", String(SITE)].map(
          (id) => `${markers.get(id)!.name} ${frameColour(markers.get(id)!.owner)}`,
        );
      };
      expect(marks("0x222")).toEqual([
        "map-realm-0 var(--hud-enemy)",
        "map-army var(--hud-enemy)",
        `${camp} var(--hud-enemy)`,
      ]);
      expect(marks("0x111")).toEqual([
        "map-realm-0 var(--hud-own)",
        "map-army var(--hud-own)",
        `${camp} var(--hud-enemy)`,
      ]);
    },
  );
});
