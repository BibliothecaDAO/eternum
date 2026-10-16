import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Icon, SvgIcon } from "./icon";
import { iconDefinition, iconMeanings, iconUrl, orderMeaning, resourceMeaning, type IconMeaning } from "./icon-meaning";
import { HexMarker } from "./hex-marker";
import { realmMeaning, realmMarkerMeaning } from "./domain-icon-meaning";
import type { ResourcesIds } from "@bibliothecadao/types";

describe("semantic painted icons", () => {
  it("gives every realm level its own portrait and hex emblem", () => {
    for (const level of [0, 1, 2, 3]) {
      expect(iconDefinition(realmMeaning(level)).art).toBe(`realm-${level}`);
      const badge = renderToStaticMarkup(
        <svg>
          <HexMarker name={realmMarkerMeaning(level)} owner="you" value={String(level)} />
        </svg>,
      );
      expect(badge).toContain(`/icons/facets/64/map-realm-${level}.webp`);
      expect(badge).toContain(`>${level}</text>`);
      expect(badge).toContain("#66ddab");
    }
    for (const invalid of [-1, 4, 1.5, NaN]) expect(() => realmMeaning(invalid)).toThrow("Unknown realm level");
  });
  it.each(iconMeanings)("renders %s with shipped artwork", (name) => {
    const html = renderToStaticMarkup(<Icon name={name} size={32} />);
    const img = new DOMParser().parseFromString(html, "text/html").querySelector("img")!;
    expect(img.getAttribute("data-icon")).toBe(name);
    expect(img.getAttribute("src")).toBe(iconUrl(name));
    expect(existsSync(resolve("public", iconUrl(name).slice(1)))).toBe(true);
    expect(img.getAttribute("width")).toBe("32");
  });
  it("keeps Transfer, Move, Production and Settings distinct", () => {
    expect(iconDefinition("transfer").art).toBe("donkey");
    expect(iconDefinition("move").art).toBe("move");
    expect(iconDefinition("production").art).toBe("production");
    expect(iconDefinition("settings").art).toBe("settings");
    expect(
      new Set((["transfer", "move", "production", "settings"] satisfies IconMeaning[]).map((name) => iconUrl(name)))
        .size,
    ).toBe(4);
  });
  it("resolves every resource ID and all Orders", () => {
    for (let id = 1; id <= 58; id++) expect(iconDefinition(resourceMeaning(id)).label.length).toBeGreaterThan(0);
    for (let id = 0; id < 17; id++) expect(orderMeaning(id)).toMatch(/^order-/);
    expect(() => resourceMeaning(999 as ResourcesIds)).toThrow("Unknown resource icon");
    expect(() => orderMeaning(999)).toThrow("Unknown Order icon");
  });
  it("selects a larger export for a large portrait and preserves its accessible label", () => {
    const html = renderToStaticMarkup(<Icon name="knight-t3" size={80} alt="Knight tier 3" />);
    expect(html).toContain("/icons/facets/256/knight-t3.webp");
    expect(html).toContain('alt="Knight tier 3"');
    expect(html).not.toContain('aria-hidden="true"');
  });
  it("uses the same artwork in the SVG minimap", () => {
    const html = renderToStaticMarkup(
      <svg>
        <SvgIcon name="map-realm" />
      </svg>,
    );
    expect(html).toContain(`href="${iconUrl("map-realm")}"`);
  });
  it("repeats ownership as colour and shape while keeping the value badge", () => {
    const markup = (owner: "you" | "ally" | "enemy") =>
      renderToStaticMarkup(
        <svg>
          <HexMarker name="map-realm" owner={owner} value="3" />
        </svg>,
      );
    expect(markup("you")).toContain("#66ddab");
    expect(markup("you")).toContain("<circle");
    expect(markup("ally")).toContain("#70bdff");
    expect(markup("ally")).toContain('width="4.4"');
    expect(markup("enemy")).toContain("#ff8176");
    expect(markup("enemy")).toContain("M0 -3 L3 2 L-3 2 Z");
    expect(markup("you")).toContain(">3</text>");
  });
});
