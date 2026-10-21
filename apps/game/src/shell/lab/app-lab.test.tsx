import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AppLabView } from "./app-lab";

const identity = vi.hoisted(() => {
  const originalSession = { user: { name: "Original player" } };
  const state = {
    session: originalSession as unknown,
    applySession(value: unknown) {
      state.session = value;
    },
  };
  return { originalSession, state, client: { sendSignInCode: vi.fn() } };
});
vi.mock("@/hooks/context/identity-session", () => ({
  identityClient: identity.client,
  useIdentitySessionStore: { getState: () => identity.state },
  // The frame's notice reads the session; the fixture pages here draw a signed-out visitor.
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));
vi.mock("../play/play-page", () => ({ PlayPage: () => <p>Fixture home</p> }));
vi.mock("../play/age-pages", () => ({ DominionPage: () => null, EternumPage: () => null, FrontierPage: () => null }));
vi.mock("../blitz/blitz-pages", () => ({ BlitzLobbyPage: () => null }));
vi.mock("../profile/profile-pages", () => ({
  PlayerPage: () => null,
  ProfilePage: () => null,
  SettingsPage: () => null,
}));
vi.mock("../season-tab/results-page", () => ({ ResultsPage: () => null }));
vi.mock("../season-tab/season-page", () => ({ SeasonPage: () => null }));
vi.mock("../news/news", () => ({ WhatsNewPage: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
let container: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

it("answers fixture reads while mounted and restores the real runtime when leaving the tool", async () => {
  const network = vi.fn(async () => new Response(JSON.stringify({ source: "network" })));
  vi.stubGlobal("fetch", network);
  const socket = window.WebSocket;
  const sendCode = identity.client.sendSignInCode;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <StrictMode>
        <MemoryRouter initialEntries={["/lab/app/home"]}>
          <Routes>
            <Route path="/lab/app/:screen/*" element={<AppLabView />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    ),
  );
  expect(container.textContent).toContain("Fixture home");
  const directory = await (await window.fetch("/api/directory")).json();
  expect(directory.shards[0].url).toBe("https://lab.invalid");
  await vi.waitFor(() => expect(identity.state.session).not.toBe(identity.originalSession));
  expect(identity.client.sendSignInCode).not.toBe(sendCode);
  await act(async () => root!.unmount());
  root = undefined;
  expect(await (await window.fetch("/api/directory")).json()).toEqual({ source: "network" });
  expect(window.fetch).toBe(network);
  expect(window.WebSocket).toBe(socket);
  expect(identity.client.sendSignInCode).toBe(sendCode);
  expect(identity.state.session).toBe(identity.originalSession);
});

const renderLab = async (path: string) => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/lab/app/:screen/*" element={<AppLabView />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  await vi.waitFor(() => expect(container.textContent).not.toContain("Loading app fixtures"));
  return container;
};

it.each([
  ["connect/start", "Send code"],
  ["connect/code", "maelis@realms.test"],
  ["connect/discord", "Discord finished in another window?"],
  ["connect/name", "Claim name"],
  ["doorway/sign-in", "Sign in to play."],
  ["doorway/map", "Stolsli"],
  ["doorway/waiting", "Starts"],
  ["doorway/preparing", "Preparing… 17/24"],
  ["terms", "Terms of Service"],
  ["no-such-page", "Nothing here"],
])("draws the fixture page %s", async (page, words) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}")),
  );
  const lab = await renderLab(`/lab/app/first-visit/${page}`);
  expect(lab.textContent).toContain(words);
});

it("draws a new account's refused name as refused", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}")),
  );
  const lab = await renderLab("/lab/app/first-visit/connect/name-refused");
  expect(lab.querySelector('input[aria-invalid="true"]')).not.toBeNull();
});

// The pages this file draws for real: a reading page and an unknown path, neither one any place holds (qa-app-1 P3-3:
// the legal pages lit What's new).
it.each([
  ["terms", []],
  ["no-such-page", []],
])("lights the place of the page it draws at %s, as the app does", async (page, lit) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}")),
  );
  const lab = await renderLab(`/lab/app/first-visit/${page}`);
  const places = [...lab.querySelectorAll('[data-role="tab"]')];
  expect(places).toHaveLength(5);
  const current = places.filter((place) => place.getAttribute("aria-current") === "page");
  expect(current.map((place) => place.textContent)).toEqual(lit);
});
