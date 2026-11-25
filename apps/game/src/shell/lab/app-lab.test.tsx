import { aspectName, ordersOfAspect } from "@bibliothecadao/types";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AppLabView } from "./app-lab";
import { LAB_CHAIN, LAB_SHARE_CODE } from "./app-lab-fixtures";
import { APP_STATE_WORDS, DOORWAY_WORDS, FOOTER_WORDS, SIGN_IN_WORDS } from "../../ui/design-system/kit/words";

const identity = vi.hoisted(() => {
  const originalSession = { user: { name: "Original player" } };
  const state = {
    session: originalSession as unknown,
    applySession(value: unknown) {
      state.session = value;
    },
  };
  return {
    originalSession,
    state,
    client: {
      sendSignInCode: vi.fn(),
      readDefaultWallet: vi.fn(),
      chooseOrder: vi.fn(),
      createInvite: vi.fn(),
    },
  };
});
vi.mock("@/hooks/context/identity-session", () => ({
  identityClient: identity.client,
  useIdentitySessionStore: Object.assign(
    <T,>(selector: (state: typeof identity.state) => T) => selector(identity.state),
    { getState: () => identity.state },
  ),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
  notificationOwnerOf: () => null,
  // The account's chosen name, as the real reader gives it: none while the name is still the account's id.
  identityUsername: (session: { user: { id: string; name: string } }) =>
    session.user.name === session.user.id ? null : session.user.name,
}));
vi.mock("../play/play-page", () => ({ PlayPage: () => <p>Fixture home</p> }));
vi.mock("../play/age-pages", () => ({ DominionPage: () => null, EternumPage: () => null, FrontierPage: () => null }));
vi.mock("../profile/profile-pages", () => ({
  PlayerPage: () => null,
  ProfilePage: () => null,
  SettingsRedirect: () => null,
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
  const readWallet = identity.client.readDefaultWallet;
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
  expect(directory.shard.url).toBe("https://lab.invalid");
  await vi.waitFor(() => expect(identity.state.session).not.toBe(identity.originalSession));
  expect(identity.client.sendSignInCode).not.toBe(sendCode);
  // The lab's player has no Realms wallet: the payout window offers to make one, not a failed read.
  expect(await identity.client.readDefaultWallet()).toBeNull();
  await act(async () => root!.unmount());
  root = undefined;
  expect(await (await window.fetch("/api/directory")).json()).toEqual({ source: "network" });
  expect(window.fetch).toBe(network);
  expect(window.WebSocket).toBe(socket);
  expect(identity.client.sendSignInCode).toBe(sendCode);
  expect(identity.client.readDefaultWallet).toBe(readWallet);
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
  // The page and any window over it, which opens at the body's end.
  return document.body;
};

it.each([
  ["connect/start", "Send code"],
  ["connect/start-refused", "has an account"],
  ["connect/opening", "Opening Discord…"],
  ["connect/code", "maelis@realms.test"],
  ["connect/code-refused", "Too many tries. Request a new code."],
  ["connect/handoff", SIGN_IN_WORDS.handoff("google")],
  ["connect/name", "Save name"],
  ["connect/name-email", SIGN_IN_WORDS.pickName],
  ["doorway/sign-in", DOORWAY_WORDS.signInToPlay],
  ["doorway/map", "Stolsli"],
  ["doorway/waiting", "Starts"],
  ["doorway/preparing", "Preparing… 17/24"],
  ["terms", FOOTER_WORDS.terms],
  ["no-such-page", APP_STATE_WORDS.nothingHere],
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

it("derives createInvite aspect from the active Season player Aspect on home and from chosen order on pre-season screens", async () => {
  await renderLab("/lab/app/home");
  const homeInvite = await identity.client.createInvite();
  expect(homeInvite).toEqual({ code: LAB_SHARE_CODE, aspect: 3, chainId: LAB_CHAIN, gameId: 1 });
  expect(aspectName(homeInvite.aspect)).toBe("Havoc");
  await act(async () => root?.unmount());
  root = undefined;
  container.remove();

  await renderLab("/lab/app/preseason-chosen");
  const chosenInvite = await identity.client.createInvite();
  expect(chosenInvite).toEqual({ code: LAB_SHARE_CODE, aspect: 1, chainId: null, gameId: null });
  expect(aspectName(chosenInvite.aspect)).toBe("Prowess");
  await identity.client.chooseOrder(ordersOfAspect(2)[0]!.orderId);
  const switchedInvite = await identity.client.createInvite();
  expect(switchedInvite).toEqual({ code: LAB_SHARE_CODE, aspect: 2, chainId: null, gameId: null });
  expect(aspectName(switchedInvite.aspect)).toBe("Luminary");
  await act(async () => root?.unmount());
  root = undefined;
  container.remove();

  await renderLab("/lab/app/realm-vault");
  const vaultInvite = await identity.client.createInvite();
  expect(vaultInvite).toEqual({ code: LAB_SHARE_CODE, aspect: 1, chainId: null, gameId: null });
});
