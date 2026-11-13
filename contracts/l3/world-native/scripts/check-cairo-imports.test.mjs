import assert from "node:assert/strict";
import { test } from "node:test";
import { functionLocalImports } from "./check-cairo-imports.mjs";

test("rejects both reported dispatcher and storage import forms inside functions", () => {
  assert.deepEqual(
    functionLocalImports(`fn initialize_deep_fixture() {
    use starknet::storage::StoragePointerWriteAccess;
    use crate::deep::IDeepSitesDispatcherTrait;
}
fn expire_explorer() {
    use crate::troops::{IBattleResolutionDispatcherTrait, IBattleResolutionLibraryDispatcher};
}`),
    [
      { functionName: "initialize_deep_fixture", line: 2 },
      { functionName: "initialize_deep_fixture", line: 3 },
      { functionName: "expire_explorer", line: 6 },
    ],
  );
});

test("allows module imports, trait declarations, comments and strings", () => {
  assert.deepEqual(
    functionLocalImports(`mod Tests {
    use crate::deep::{DeepShare, IDeepRewardsDispatcherTrait};
    trait View<T> { fn read(self: @T); }
    fn read() {
        // use crate::bad;
        /* use crate::bad; */
        let message = "use crate::bad; }";
        let short = 'use crate::bad;';
    }
}`),
    [],
  );
});

test("finds imports in nested blocks and after a generic function signature", () => {
  assert.deepEqual(
    functionLocalImports(`fn read<T, +Drop<T>>(value: T) {
    if true { use crate::bad as alias; }
}`),
    [{ functionName: "read", line: 2 }],
  );
});
