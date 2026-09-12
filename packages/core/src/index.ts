export * from "./account/gameplay-account";
export * from "./account/transaction-resource-bounds";
export * from "./data";
export * from "./managers";
export * from "./stores";
export * from "./systems";
export * from "./utils";
export * from "./utils/map/hex";
export * from "./utils/resource-arrivals";
// The client composition depends on the config manager and setup(), so it ships with the barrel, not the
// light game-client subpath that app tests evaluate for real while mocking this package wholesale. It stays
// last: evaluating it first would enter the managers through config-manager's own import cycle and leave
// the barrel's manager exports partially forwarded under vitest.
export * from "./client/game-client";
export * from "./client/views";
