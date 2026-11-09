import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("@/runtime/distribution-channel");
  vi.resetModules();
});

/** The wallets the provider offers in this app, as the one surface with connectors (wallet-actions.tsx) lists them. */
const connectorsIn = async (channel: "web" | "play" | "app-store") => {
  vi.resetModules();
  vi.doMock("@/runtime/distribution-channel", () => ({
    distributionChannel: () => channel,
    opensThirdPartySignIn: () => channel !== "app-store",
  }));
  const { StarknetProvider } = await import("./starknet-provider");
  const { useConnect } = await import("@starknet-react/core");
  const seen: string[][] = [];
  const Listed = () => {
    seen.push(useConnect().connectors.map((connector) => connector.id));
    return null;
  };
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(
      <StarknetProvider>
        <Listed />
      </StarknetProvider>,
    ),
  );
  await act(async () => root.unmount());
  return seen.at(-1);
};

// One page makes one Controller (its package keeps the first), so the web stands for both channels that open wallets.
it("offers every wallet a player links on the web", async () => {
  expect(await connectorsIn("web")).toEqual(["controller", "argentX", "argentWebWallet", "braavos"]);
});

it("offers no wallet inside the iOS app, so none is listed or prompted there", async () => {
  expect(await connectorsIn("app-store")).toEqual([]);
});
