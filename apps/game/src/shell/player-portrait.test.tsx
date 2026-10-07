import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("react-router-dom", async (original) => ({
  ...(await original<typeof import("react-router-dom")>()),
  useParams: () => ({ address: "0x111" }),
}));
vi.mock("./herald", () => ({
  useDirectory: () => ({ data: { games: [] } }),
  useRecentResults: () => ({ data: { games: [] }, isSuccess: true }),
  useLeaderboard: () => ({}),
}));

import { playerAvatarUrl } from "@/hooks/use-player-profile";
import { PlayerPage } from "./profile/profile-pages";

it("uses the same unchosen portrait on the public profile and in the game", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <PlayerPage />
    </MemoryRouter>,
  );
  expect(html).toContain(`src="${playerAvatarUrl("0x111", { name: null, portrait: null })}"`);
});
