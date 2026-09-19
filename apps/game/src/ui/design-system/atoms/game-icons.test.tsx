// @vitest-environment node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as icons from "./game-icons";

describe("game image icons", () => {
  it("resolves every icon to a published image", () => {
    for (const [name, Icon] of Object.entries(icons)) {
      const html = renderToStaticMarkup(createElement(Icon));
      const src = html.match(/src="([^"]+)"/)?.[1];
      expect(src, name).toMatch(/^\/(image-icons|images)\/.+\.png$/);
      expect(existsSync(resolve(process.cwd(), "public", src!.slice(1))), `${name}: ${src}`).toBe(true);
      expect(html, name).not.toContain("<svg");
    }
  });

  it("keeps controls decorative unless an accessible name is supplied", () => {
    const decorative = renderToStaticMarkup(<icons.X className="h-4 w-4" />);
    const labelled = renderToStaticMarkup(<icons.Eye alt="Spectating" size={32} />);
    expect(decorative).toContain('alt=""');
    expect(decorative).toContain('class="inline-block shrink-0 object-contain h-4 w-4"');
    expect(labelled).toContain('alt="Spectating"');
    expect(labelled).toContain('width="32"');
    expect(labelled).toContain('height="32"');
  });

  it("preserves direction independently of caller animations", () => {
    const html = renderToStaticMarkup(<icons.ChevronUp className="rotate-180" />);
    expect(html).toContain("rotate:180deg");
    expect(html).toContain("rotate-180");
  });
});
