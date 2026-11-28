import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { identityClient } from "@/hooks/context/identity-session";
import { SEAL_CODE_WORDS } from "@/ui/design-system/kit/words";

import { SealCodeCard } from "./seal-code-card";

const unmounts: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const unmount of unmounts.splice(0)) await unmount();
  vi.restoreAllMocks();
});

const mount = async (entry: string, options: { compact?: boolean; embedded?: boolean; owner?: string | null } = {}) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let navigateTo: ((to: string) => void) | null = null;
  const Harness = () => {
    navigateTo = useNavigate();
    return <SealCodeCard owner={options.owner ?? "0xa1"} compact={options.compact} embedded={options.embedded} />;
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="*" element={<Harness />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  unmounts.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return {
    container,
    navigate: async (to: string) => {
      await act(async () => navigateTo!(to));
    },
  };
};

it("prefills the Redeem input from /shop?code=<CODE>, submits it cleanly, and updates on navigation", async () => {
  vi.spyOn(identityClient, "getSealCode").mockResolvedValue({ held: false });
  const redeem = vi.spyOn(identityClient, "redeemSealCode").mockResolvedValue({ held: true });

  const { container, navigate } = await mount("/shop?code=CHAR-M234");
  await vi.waitFor(() => expect(container.querySelector('[data-seal-code="open"]')).not.toBeNull());
  const input = container.querySelector<HTMLInputElement>('[data-seal-code="open"] input')!;
  expect(input.value).toBe("CHAR-M234");
  const submitButton = container.querySelector<HTMLButtonElement>('[data-seal-code="open"] button[type="submit"]')!;
  expect(submitButton.disabled).toBe(false);

  await navigate("/shop?code=BRAV-E234");
  expect(input.value).toBe("BRAV-E234");

  await act(async () => {
    container.querySelector<HTMLFormElement>('[data-seal-code="open"] form')!.requestSubmit();
  });
  expect(redeem).toHaveBeenCalledWith("BRAV-E234");
  await vi.waitFor(() => expect(container.querySelector('[data-seal-code="held"]')).not.toBeNull());
  expect(container.textContent).toContain(SEAL_CODE_WORDS.held);
});

it("auto-expands the compact disclosure when ?code=<CODE> is present and keeps it collapsed otherwise", async () => {
  vi.spyOn(identityClient, "getSealCode").mockResolvedValue({ held: false });

  const plain = await mount("/play", { compact: true });
  await vi.waitFor(() => expect(plain.container.querySelector('[data-seal-code="open"]')).not.toBeNull());
  expect(plain.container.querySelector("input")).toBeNull();

  const prefilled = await mount("/play?code=GIFT-2345", { compact: true });
  await vi.waitFor(() => expect(prefilled.container.querySelector('[data-seal-code="open"] input')).not.toBeNull());
  expect(prefilled.container.querySelector<HTMLInputElement>("input")!.value).toBe("GIFT-2345");
});

it("preserves the embedded shop-code-well layout while prefilling ?code=<CODE>", async () => {
  vi.spyOn(identityClient, "getSealCode").mockResolvedValue({ held: false });
  const redeem = vi.spyOn(identityClient, "redeemSealCode").mockResolvedValue({ held: true });

  const { container } = await mount("/shop?code=SHOP-2345", { embedded: true });
  await vi.waitFor(() => expect(container.querySelector("section.shop-code-well")).not.toBeNull());
  expect(container.querySelector<HTMLInputElement>("input")!.value).toBe("SHOP-2345");

  await act(async () => {
    container.querySelector<HTMLFormElement>("section.shop-code-well form")!.requestSubmit();
  });
  expect(redeem).toHaveBeenCalledWith("SHOP-2345");
  await vi.waitFor(() =>
    expect(container.querySelector('section.shop-code-well[data-seal-code="held"]')).not.toBeNull(),
  );
});
