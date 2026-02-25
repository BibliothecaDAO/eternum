import { describe, expect, it, vi, beforeEach } from "vitest";

const execFileSyncMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
}));

import { checkAgentBrowserInstalled, runAuthApprove } from "../../src/session/auth-approve";

describe("auth-approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkAgentBrowserInstalled", () => {
    it("returns true when agent-browser is found", () => {
      execFileSyncMock.mockReturnValue("/usr/local/bin/agent-browser");
      expect(checkAgentBrowserInstalled()).toBe(true);
      expect(execFileSyncMock).toHaveBeenCalledWith("which", ["agent-browser"], { encoding: "utf-8" });
    });

    it("returns false when agent-browser is not found", () => {
      execFileSyncMock.mockImplementation(() => {
        throw new Error("not found");
      });
      expect(checkAgentBrowserInstalled()).toBe(false);
    });
  });

  describe("runAuthApprove", () => {
    it("throws when agent-browser is not installed", async () => {
      execFileSyncMock.mockImplementation(() => {
        throw new Error("not found");
      });

      await expect(
        runAuthApprove({
          authUrl: "https://auth.example.com",
          method: "password",
          username: "bot",
          password: "pass",
        }),
      ).rejects.toThrow("agent-browser not found");
    });

    it("throws for unsupported auth methods", async () => {
      // which returns success (agent-browser installed)
      execFileSyncMock.mockReturnValue("/usr/local/bin/agent-browser");

      await expect(
        runAuthApprove({
          authUrl: "https://auth.example.com",
          method: "google",
          username: "bot",
          password: "pass",
        }),
      ).rejects.toThrow('Auth method "google" is not yet supported');
    });

    it("throws when username/password missing for password method", async () => {
      // which check succeeds
      execFileSyncMock.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === "which") return "/usr/local/bin/agent-browser";
        throw new Error("unexpected call");
      });

      await expect(
        runAuthApprove({
          authUrl: "https://auth.example.com",
          method: "password",
        }),
      ).rejects.toThrow("--username and --password required");
    });

    it("shells out to agent-browser in correct sequence for password flow", async () => {
      const calls: Array<{ cmd: string; args: string[] }> = [];
      execFileSyncMock.mockImplementation((cmd: string, args: string[], _opts: unknown) => {
        calls.push({ cmd, args });
        if (cmd === "which") return "/usr/local/bin/agent-browser";
        // Mock snapshot output with form fields
        if (cmd === "agent-browser" && args[0] === "snapshot") {
          if (calls.filter((c) => c.args[0] === "snapshot").length === 1) {
            // First snapshot: login form
            return '@e1 [input type="email"] "Email"\n@e2 [input type="password"] "Password"\n@e3 [button] "Sign in"';
          }
          // Second snapshot: policy approval
          return '@e1 [button] "Approve"';
        }
        return "";
      });

      await runAuthApprove({
        authUrl: "https://auth.example.com/session",
        method: "password",
        username: "bot@test.com",
        password: "secret123",
      });

      // Verify sequence: open, wait, snapshot, fill, fill, click, wait, snapshot, click, wait, close
      const abCalls = calls.filter((c) => c.cmd === "agent-browser");
      expect(abCalls[0].args[0]).toBe("open");
      expect(abCalls[0].args[1]).toBe("https://auth.example.com/session");
      expect(abCalls.some((c) => c.args[0] === "fill" && c.args[1] === "@e1")).toBe(true);
      expect(abCalls.some((c) => c.args[0] === "fill" && c.args[1] === "@e2")).toBe(true);
      expect(abCalls.some((c) => c.args[0] === "click" && c.args[1] === "@e3")).toBe(true);
      expect(abCalls[abCalls.length - 1].args[0]).toBe("close");
    });
  });
});
