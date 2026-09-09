import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("./hud-chat-window", () => ({ HudChatWindow: () => <footer>Chat strip</footer> }));
vi.mock("@/ui/features/event-feed/quick-feed", () => ({ QuickFeed: () => <nav>Quick feed</nav> }));
import { RightHudColumn } from "./right-hud-column";
it.each(["Realm", "Relic Crate", "Biome"])("stacks feed, bottom-anchored %s details, then the chat strip", (name) => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <RightHudColumn>
      <article>{name}</article>
    </RightHudColumn>,
  );
  const aside = container.querySelector("aside")!;
  expect(aside.className).toContain("top-[60px]");
  expect(aside.firstElementChild?.textContent).toBe("Quick feed");
  const details = container.querySelector('[aria-label="Tile details"]')!;
  expect(details.className).toContain("mt-auto");
  expect(details.className).toContain("max-h-[60%]");
  expect(details.nextElementSibling?.textContent).toBe("Chat strip");
  expect(aside.lastElementChild?.textContent).toBe("Chat strip");
});
