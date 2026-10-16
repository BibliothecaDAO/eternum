import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import { iconUrl, resourceMeaning } from "../icon-meaning";
import { ResourceIcon } from "./resource-icon";

const EVERY_RESOURCE = Object.values(ResourcesIds).filter((value): value is ResourcesIds => typeof value === "number");

describe("ResourceIcon", () => {
  it.each(EVERY_RESOURCE.map((id) => [ResourcesIds[id], id] as const))(
    "draws %s by its id with its shipped artwork",
    (_name, id) => {
      const html = renderToStaticMarkup(<ResourceIcon resource={id} size="md" />);
      const img = new DOMParser().parseFromString(html, "text/html").querySelector("img")!;
      expect(img.getAttribute("data-icon")).toBe(resourceMeaning(id));
      expect(img.getAttribute("src")).toBe(iconUrl(resourceMeaning(id), 64));
      expect(existsSync(resolve("public", iconUrl(resourceMeaning(id)).slice(1)))).toBe(true);
    },
  );
});

it("shows the official LORDS mark in resource amounts and transfer rows", () => {
  const html = renderToStaticMarkup(<ResourceIcon resource={ResourcesIds.Lords} size="xl" />);
  expect(html).toContain('src="/tokens/lords.png"');
  expect(html).not.toContain("/icons/facets/");
});
