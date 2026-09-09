import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("./hud-chat-window", () => ({ HudChatWindow: () => <section>Events and Chat</section> }));
import { RightHudColumn } from "./right-hud-column";
it.each(["Realm", "Relic Crate", "Biome"])("anchors %s below the flexible events panel", (name) => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <RightHudColumn>
      <article>{name}</article>
    </RightHudColumn>,
  );
  const details = container.querySelector('[aria-label="Tile details"]')!;
  expect(details).toBe(container.querySelector("aside")?.lastElementChild);
  expect(details.className).toContain("shrink-0");
  expect(details.className).toContain("max-h-[60%]");
  expect(details.previousElementSibling?.className).toContain("flex-1");
  expect(details.previousElementSibling?.textContent).toBe("Events and Chat");
});
