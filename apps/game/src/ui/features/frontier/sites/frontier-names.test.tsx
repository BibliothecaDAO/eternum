import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { getGameModeConfig } from "@/config/game-modes";
import { GAME_FAMILIES } from "../../../../../../../config/source/common/native-preset-modes";
import { Plate } from "@/three/map-plates/map-plates";
import { buildStructurePlate } from "@/three/map-plates/map-plate-model";
import { kindsHeld } from "@/ui/features/world/hud/holdings-model";
import { buildStoryEventPresentation, readFrontierBeast, siteDisplayName } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { dayEndItems } from "../day-end/day-end";
import { attackTargetName } from "./site-marks";
import { SiteCardView } from "./site-card-view";
import { SiteReceipt } from "./site-receipt";
import { campBeside, SITE, SITE_TILE } from "./site-fixture";

/** Inspect visible words and accessible labels, not contract keys or artwork URLs. */
const publicText = (view: ReactNode) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(view));
  const text = [
    host.textContent,
    ...[...host.querySelectorAll("[aria-label],[title],[alt]")].flatMap((node) => [
      node.getAttribute("aria-label"),
      node.getAttribute("title"),
      node.getAttribute("alt"),
    ]),
  ]
    .filter(Boolean)
    .join(" ");
  act(() => root.unmount());
  host.remove();
  return text;
};

it("names a known camp by its beast on the plate, cards, receipt and Events, and the kind alone by its family", () => {
  const { store, site, structure } = campBeside();
  const mode = getGameModeConfig(GAME_FAMILIES.frontier);
  const beast = readFrontierBeast(store, 1, SITE)!;
  expect(beast.name).toBe("Golem");
  const identity = { ...beast, art: "beast-troll" as const, combatClass: "Knight" as const };
  const plate = buildStructurePlate({
    entityId: SITE,
    level: 0,
    hasWonder: false,
    structureName: "",
    structureType: StructureType.Camp,
    isMine: false,
    isAlly: false,
    owner: { address: 0n, ownerName: "", guildName: "" },
    frontierBeast: beast,
  });
  const clear = {
    ...site,
    clear: { explorer_id: 201n, home_id: 7n, reward: { resource_type: 37, amount: 550_000_000_000n } },
  };
  const events = [
    buildStoryEventPresentation(
      {
        storyType: "SitePayout",
        storyPayload: { site_id: SITE, category: StructureType.Camp, explorer_id: 201, reward: null },
        ownerAddress: "0x111",
        viewerAddress: "0x111",
      } as never,
      store,
    ),
    buildStoryEventPresentation(
      {
        storyType: "ExplorationReward",
        storyPayload: { explorer_id: 201, coord: { x: SITE_TILE.col, y: SITE_TILE.row, alt: false }, reward: null },
      } as never,
      store,
    ),
  ];
  const dayEnd = dayEndItems({ camp: { x: 40, y: 12 }, armyCanExplore: false });
  const kindWords = {
    listHeading: kindsHeld([{ category: StructureType.Camp, structure }], mode.id)[0].plural,
    unknownGuard: attackTargetName("Camp"),
    dayEnd: dayEnd.map(({ line, verb }) => `${line} ${verb}`).join(" "),
  };
  const words = {
    kindLine: publicText(<Plate plate={plate} />),
    selectionLabel: attackTargetName("Camp", identity),
    events: events.map(({ title, description }) => `${title} ${description}`).join(" "),
    card: publicText(
      <SiteCardView
        site="Camp"
        beast={identity}
        army={null}
        guard={1100}
        fight={undefined}
        pay={null}
        verb={null}
        onClose={() => {}}
      />,
    ),
    receipt: publicText(<SiteReceipt selected={{ site: clear, beast }} />),
  };
  for (const [surface, text] of Object.entries(words)) {
    expect(text, surface).toContain(beast.name);
    expect(text, surface).not.toMatch(/\bcamps?\b/i);
    expect(text, surface).not.toContain(`${beast.name} ${beast.name}`);
  }
  for (const [surface, text] of Object.entries(kindWords)) {
    expect(text, surface).toMatch(/\bCamps?\b/);
    expect(text, surface).not.toContain(beast.name);
  }
  expect(mode.structure.getName(structure, {} as never).name).toBe(siteDisplayName(Number(structure.entity_id)));
  expect(words.kindLine.split(beast.name)).toHaveLength(2);
  expect(events[0].title).toBe(`${siteDisplayName(SITE)} cleared`);
  // A discovery names the site as its clear does; what guards it is the kind beside it.
  expect(events[1].title).toContain(`${siteDisplayName(SITE)} found`);
  expect(events[1].description?.startsWith(`${beast.name} · `)).toBe(true);
});

it("retains site proper names and Camp for Blitz kind lines and lists", () => {
  const { structure } = campBeside();
  const mode = getGameModeConfig(GAME_FAMILIES.blitz);
  expect(mode.structure.getName(structure, {} as never).name).toBe(siteDisplayName(Number(structure.entity_id)));
  expect(mode.structure.getTypeName(StructureType.Camp)).toBe("Camp");
  expect(kindsHeld([{ category: StructureType.Camp, structure }], mode.id)[0].plural).toBe("Camps");
});
