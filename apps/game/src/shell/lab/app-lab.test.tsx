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
}));
vi.mock("../play/play-page", () => ({ PlayPage: () => <p>Fixture home</p> }));
vi.mock("../play/age-pages", () => ({ DominionPage: () => null, EternumPage: () => null, FrontierPage: () => null }));
vi.mock("../blitz/blitz-pages", () => ({ BlitzListPage: () => null, BlitzLobbyPage: () => null }));
vi.mock("../profile/profile-pages", () => ({
  PlayerPage: () => null,
  ProfilePage: () => null,
  ProfileRowPage: () => null,
}));
vi.mock("../season-tab/results-page", () => ({ ResultsPage: () => null }));
vi.mock("../season-tab/season-page", () => ({ SeasonPage: () => null }));
vi.mock("../learn/learn-page", () => ({ LearnPage: () => null }));
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
