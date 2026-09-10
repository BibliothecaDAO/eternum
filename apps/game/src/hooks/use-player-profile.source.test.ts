// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

it("resolves every player name and portrait through the one players-slice resolver", () => {
  expect(existsSync("src/hooks/use-player-avatar.tsx")).toBe(false);
  for (const path of [
    "src/three/managers/army-manager.ts",
    "src/ui/features/world/components/entities/hooks/use-structure-entity-detail.ts",
    "src/ui/features/social/realtime-chat/ui/world-chat/world-chat-panel.tsx",
    "src/ui/features/world/containers/hud-chat-window.tsx",
    "src/ui/modules/settings/settings.tsx",
  ]) {
    const source = read(path);
    expect(source, path).toContain('from "@/hooks/use-player-profile"');
    expect(source, path).not.toMatch(/getAddressName\(|decodeShortString\(|use-player-avatar/);
  }
  // The bridge merges identity's profile over the chain name; nothing else asks identity for names.
  const bridge = read("src/sync/recs-store-bridge.ts");
  expect(bridge).toContain("identityProfiles.get(address)");
  expect(bridge).toContain("profileOfIdentityUser(user)");
  // Registration writes the identity username; the dead account-store name is gone.
  expect(read("src/hooks/store/use-account-store.ts")).not.toContain("accountName");
  expect(read("src/hooks/use-world-registration.ts")).toContain("identityUsername(state.session)");
});
