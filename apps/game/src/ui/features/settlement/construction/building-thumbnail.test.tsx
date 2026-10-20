import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BuildingType, ResourceMiningTypes, ResourcesIds, getBuildingFromResource } from "@bibliothecadao/types";
import { ResourceIdToMiningType } from "@bibliothecadao/eternum";
import { buildingModelPaths, BUILDINGS_GROUPS } from "@/three/constants/scene-constants";
import manifest from "../../../../../asset-sources/building-thumbnails.json";
import { BuildingThumbnail } from "./building-thumbnail";
import { BuildingCard } from "./select-preview-building";

const lane = vi.hoisted(() => ({ value: null as null | "portrait" }));
vi.mock("@/hooks/helpers/use-compact-hud", () => ({ useCompactLane: () => lane.value }));

function dom(element: React.ReactElement) {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(element);
  return container;
}

const entries = manifest as Record<string, { model: string; modelSha256: string; imageSha256: string }>;
const sha256 = (path: string) =>
  createHash("sha256")
    .update(readFileSync(`public${path}`))
    .digest("hex");

describe("construction model thumbnails", () => {
  it("renders every building from its current in-game GLB", () => {
    const scene = buildingModelPaths(false);
    const models: Partial<Record<BuildingType | ResourceMiningTypes, string>> = {
      ...scene[BUILDINGS_GROUPS.BUILDINGS],
      ...scene[BUILDINGS_GROUPS.RESOURCES_MINING],
    };
    for (const [resource, kind] of Object.entries(ResourceIdToMiningType)) {
      models[getBuildingFromResource(Number(resource))] = scene[BUILDINGS_GROUPS.RESOURCES_MINING][kind];
    }
    const kinds = Object.values(BuildingType).filter((value): value is BuildingType => typeof value === "number");
    const rendered = new Set<string>();
    for (const building of kinds) {
      const src = dom(<BuildingThumbnail building={building} />)
        .querySelector("img")
        ?.getAttribute("src");
      expect(src, `building ${building}`).toMatch(/^\/images\/buildings\/construction\//);
      expect(entries[src!]?.model, `model for ${building}`).toBe(models[building]);
      expect(models[building]).toBeTruthy();
      rendered.add(src!);
    }
    expect([...rendered].sort()).toEqual(Object.keys(entries).sort());
  });

  it("ships the recorded current model and rendered PNG bytes", () => {
    for (const [image, entry] of Object.entries(entries)) {
      expect(sha256(entry.model), `${entry.model}: regenerate construction thumbnails`).toBe(entry.modelSha256);
      expect(sha256(image), image).toBe(entry.imageSha256);
      const png = readFileSync(`public${image}`);
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([384, 384]);
    }
  });

  it.each([null, "portrait"] as const)("uses model artwork and keeps Facets on cards at %s", (value) => {
    lane.value = value;
    const card = dom(
      <BuildingCard
        buildingId={BuildingType.ResourceWheat}
        buildingName="Farm"
        active={false}
        onClick={() => {}}
        entityId={undefined}
        useSimpleCost={false}
        requirements={[{ resource: ResourcesIds.Wood, current: 20, amount: 10 }]}
      />,
    );
    expect(card.querySelector("[data-building-thumbnail]")?.getAttribute("src")).toBe(
      "/images/buildings/construction/farm.png",
    );
    expect(card.querySelector("[data-icon]")?.getAttribute("src")).toContain("/icons/facets/");
  });
});
