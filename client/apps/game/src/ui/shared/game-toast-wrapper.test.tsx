import { beforeEach, describe, expect, it, vi } from "vitest";

const sonnerToastMock = vi.hoisted(() => {
  const base = vi.fn();
  return Object.assign(base, {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    loading: vi.fn(),
    custom: vi.fn(),
    dismiss: vi.fn(),
  });
});

vi.mock("sonner", () => ({
  toast: sonnerToastMock,
}));

import { gameToast } from "./game-toast";

describe("gameToast", () => {
  beforeEach(() => {
    sonnerToastMock.mockReset();
    sonnerToastMock.success.mockReset();
  });

  it("keeps lazy descriptions callable", () => {
    gameToast.success("Market resolved", {
      description: () => "Rewards are ready.",
    });

    const options = sonnerToastMock.success.mock.calls[0]?.[1];

    expect(typeof options?.description).toBe("function");
  });
});
