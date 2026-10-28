import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { getGameModeConfig } from "@/config/game-modes";
import { Plate } from "@/three/map-plates/map-plates";
import { buildStructurePlate } from "@/three/map-plates/map-plate-model";
import { RESEARCH_TREE, ARMY_DETAIL } from "@/ui/design-system/kit/words";
import { kindsHeld } from "@/ui/features/world/hud/holdings-model";
import { buildStoryEventPresentation, frontierBeast, siteDisplayName } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { frontierCoachSteps } from "../next-up/frontier-coach";
import type { NextUpFacts } from "../next-up/next-up-facts";
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

it("names the Frontier encounter itself across the plate, cards, Events, lists and Next up, never Camp", () => {
  const { store, site, structure } = campBeside();
  const mode = getGameModeConfig(5);
  const beast = frontierBeast(0, StructureType.Camp);
  const identity = { ...beast, art: "beast-troll" as const, combatClass: "Knight" as const };
  const plate = buildStructurePlate({
    entityId: SITE,
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
  const coach = frontierCoachSteps({ realm: true, barracks: true, armies: 0, camp: { x: 40, y: 12 } } as NextUpFacts, {
    pointer: "mouse",
    where: "map",
    tips: true,
  });
  const words = {
    kindLine: publicText(<Plate plate={plate} />),
    listHeading: kindsHeld([{ category: StructureType.Camp, structure }], mode.id)[0].plural,
    selectionLabel: attackTargetName("Camp", identity),
    unknownGuard: attackTargetName("Camp"),
    scouting: RESEARCH_TREE.kinds.camp,
    armyEarn: ARMY_DETAIL.earn.clear,
    coach: coach.map(({ line, verb }) => `${line} ${verb}`).join(" "),
    events: events.map(({ title, description }) => `${title} ${description}`).join(" "),
    card: publicText(
      <SiteCardView
        site="Camp"
        beast={identity}
        army={null}
        guard={1100}
        fight={undefined}
        pay={null}
        xp={82}
        verb={null}
        onClose={() => {}}
      />,
    ),
    receipt: publicText(<SiteReceipt selected={{ site: clear }} />),
  };
  for (const [surface, text] of Object.entries(words)) {
    expect(text, surface).toMatch(/Troll/);
    expect(text, surface).not.toMatch(/\bcamps?\b/i);
    expect(text, surface).not.toContain("Troll Troll");
  }
  expect(mode.structure.getName(structure).name).toBe(siteDisplayName(Number(structure.entity_id)));
  expect(words.kindLine.match(/Troll/g)).toHaveLength(1);
  expect(events[0].title).toBe(`${siteDisplayName(SITE)} cleared`);
  // A discovery names the site as its clear does; what guards it is the kind beside it.
  expect(events[1].title).toContain(`${siteDisplayName(SITE)} found`);
  expect(events[1].description).toMatch(/^Troll · /);
});

it("retains site proper names and Camp for Blitz kind lines and lists", () => {
  const { structure } = campBeside();
  const mode = getGameModeConfig(2);
  expect(mode.structure.getName(structure).name).toBe(siteDisplayName(Number(structure.entity_id)));
  expect(mode.structure.getTypeName(StructureType.Camp)).toBe("Camp");
  expect(kindsHeld([{ category: StructureType.Camp, structure }], mode.id)[0].plural).toBe("Camps");
});
