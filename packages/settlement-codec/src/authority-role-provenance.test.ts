import { describe, expect, test } from "vitest";
import { validateCompleteObservedRoleHistory } from "../../../scripts/settlement/verify-authority-observation.mjs";

const DEFAULT_ADMIN_ROLE = "0x0";
const ARCHIVED_ROLE = "0x1";
const GOVERNANCE_ROLE = "0x2";
const MEMBER = "0x123";

describe("A20 complete role-history provenance", () => {
  test("retains a role whose only member was fully revoked", () => {
    expect(() => validateCompleteObservedRoleHistory(roleEvents(), observedRoles())).not.toThrow();
  });

  test("rejects omission of a fully revoked role", () => {
    const roles = observedRoles().filter(({ roleId }) => roleId !== ARCHIVED_ROLE);

    expect(() => validateCompleteObservedRoleHistory(roleEvents(), roles)).toThrow("MMR observed role set mismatch");
  });

  test("rejects omission of a role used as an admin edge", () => {
    const roles = observedRoles().filter(({ roleId }) => roleId !== GOVERNANCE_ROLE);

    expect(() => validateCompleteObservedRoleHistory(roleEvents(), roles)).toThrow("MMR observed role set mismatch");
  });

  test("rejects roles absent from the complete history", () => {
    const roles = [...observedRoles(), role("0x3", DEFAULT_ADMIN_ROLE, [])];

    expect(() => validateCompleteObservedRoleHistory(roleEvents(), roles)).toThrow("MMR observed role set mismatch");
  });

  test("binds the final admin-role edge derived from RoleAdminChanged history", () => {
    const roles = observedRoles().map((observedRole) =>
      observedRole.roleId === ARCHIVED_ROLE ? { ...observedRole, adminRoleId: DEFAULT_ADMIN_ROLE } : observedRole,
    );

    expect(() => validateCompleteObservedRoleHistory(roleEvents(), roles)).toThrow(
      `MMR observed admin role ${ARCHIVED_ROLE} mismatch`,
    );
  });

  test("rejects an admin transition whose previous edge does not match history", () => {
    const events = roleEvents();
    events.push(adminChanged(ARCHIVED_ROLE, DEFAULT_ADMIN_ROLE, GOVERNANCE_ROLE));

    expect(() => validateCompleteObservedRoleHistory(events, observedRoles())).toThrow(
      `MMR previous admin role ${ARCHIVED_ROLE} mismatch`,
    );
  });

  test("rejects duplicate observed role IDs", () => {
    const roles = [...observedRoles(), role(ARCHIVED_ROLE, GOVERNANCE_ROLE, [])];

    expect(() => validateCompleteObservedRoleHistory(roleEvents(), roles)).toThrow(
      "MMR observed role set contains duplicate role IDs",
    );
  });
});

function roleEvents() {
  return [
    granted(DEFAULT_ADMIN_ROLE, MEMBER),
    granted(ARCHIVED_ROLE, MEMBER),
    revoked(ARCHIVED_ROLE, MEMBER),
    adminChanged(ARCHIVED_ROLE, DEFAULT_ADMIN_ROLE, GOVERNANCE_ROLE),
  ];
}

function observedRoles() {
  return [
    role(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE, [MEMBER]),
    role(ARCHIVED_ROLE, GOVERNANCE_ROLE, []),
    role(GOVERNANCE_ROLE, DEFAULT_ADMIN_ROLE, []),
  ];
}

function role(roleId: string, adminRoleId: string, members: string[]) {
  return { name: `ROLE_${roleId}`, roleId, adminRoleId, members };
}

function granted(roleId: string, account: string) {
  return roleEvent("RoleGranted", roleId, account, DEFAULT_ADMIN_ROLE);
}

function revoked(roleId: string, account: string) {
  return roleEvent("RoleRevoked", roleId, account, DEFAULT_ADMIN_ROLE);
}

function adminChanged(roleId: string, previousAdminRoleId: string, newAdminRoleId: string) {
  return roleEvent("RoleAdminChanged", roleId, previousAdminRoleId, newAdminRoleId);
}

function roleEvent(event: string, roleId: string, account: string, sender: string) {
  return {
    blockNumber: 1,
    transactionHash: "0x1",
    eventIndex: 0,
    event,
    roleId,
    account,
    sender,
  };
}
