import { mkdtemp, mkdir, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { privateWrite } from "./config";
import { recoverStaleState, removeStackState } from "./lifetime";
const docker = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFileSync: docker }));
it("removes dead supervisor material and every labelled container before a new run can claim the directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "value-stack-stale-"));
  const state = { directory, pid: join(directory, "process.json") };
  try {
    await mkdir(join(directory, "run-1"));
    await privateWrite(join(directory, "run-1/credentials.json"), { fixture: "private" });
    await privateWrite(state.pid, { pid: 2147483647, configPath: "/test", runDirectory: join(directory, "run-1") });
    docker.mockImplementation((_command, args) => (args[0] === "ps" ? "abcdef012345\n123456abcdef\n" : ""));
    await recoverStaleState(state);
    await expect(stat(state.pid)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(join(directory, "run-1"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(docker).toHaveBeenCalledWith("docker", ["rm", "-f", "abcdef012345", "123456abcdef"], { stdio: "ignore" });
    await privateWrite(state.pid, { pid: process.pid, configPath: "/test", runDirectory: join(directory, "run-2") });
    await expect(recoverStaleState(state)).rejects.toThrow("stack_already_running");
    await removeStackState(state);
    await expect(stat(directory)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
