# Phase 1 receipt measurements

Confirmed receipts on `74781730dbe`, captured on one disposable shard on 2026-09-25. The
[machine-readable table](phase1-exit.json) includes transaction hashes, gas, call counts and replay checks. Existing
evidence supplies the older columns; no old deployment was rebuilt.

| Action                                     | Pre-A1 `8f98abf8d18` L2 gas | A3 `619f0d62365` L2 gas | Phase 1 `74781730dbe` L2 gas |
| ------------------------------------------ | --------------------------: | ----------------------: | ---------------------------: |
| Explore, plain                             |                  78,452,951 |              56,279,275 |                   45,374,360 |
| Move                                       |                  47,344,106 |              34,206,960 |                   26,431,036 |
| Enter depth                                |                 no baseline |              29,561,743 |                   25,162,311 |
| Attack explorer                            |                 no baseline |             no baseline |                   35,583,832 |
| Attack guard                               |                  91,714,664 |             no baseline |                   28,173,743 |
| Building placement                         |                  46,645,798 |             no baseline |                   15,150,081 |
| Roster settlement, first three-camp batch  |                 644,905,627 |             no baseline |                  462,417,747 |
| Roster settlement, second three-camp batch |                 no baseline |             no baseline |                  460,539,140 |

Each final receipt contains one successful ticket through normal admission, signature and nonce validation. Historical
simulation at the preceding block, with `SKIP_FEE_CHARGE`, reproduces its resources and ordered events exactly. The two
roster batches complete one six-camp roster. The pre-A1 roster receipt settled three camps; its recorded attack command
was `BattleGuard`.

These are observed workloads, not identical random outcomes. The pre-A1 building, battle and exploration state differ
from the new game. The A3 and final Frontier movement measurements use the same preset calldata and commitment
(`0x32d040d38eaec07c36ec90bfc3881c0595100110f8772c1cd7c1e406d72d463`), including the approved run-only starting Essence
fixture. No fixture was added to a release or environment configuration. Combat and building use preset 2. The explorer
fight starts with 1,000 versus 10 knights; the guard fight starts with the surviving 996 knights versus 1,500 guarding
knights. Both receipts contain combat with nonzero defenders. No percentage reduction is inferred across different
workloads.

Native receipts expose L1 gas, L1 data gas and L2 gas. Cairo steps, builtin counts and complete syscall counts are
unavailable on native execution. Trace `CALL` and `DELEGATE` edges are counted separately; they are not syscall counts.
The pre-A1 collector recorded no library calls before the class cutover.

The same recording checks emitted ActionNonce and projected points against the contract's nonce and player-points views,
and compares overlay, confirmation, checkpoint restoration and replay. The run used local identity and guardian Workers
with run-only keys. All containers, volumes, private material and the isolated lock were removed after capture.

Raw final evidence: `native-contracts-evidence/phase1-exit/final-head/`. Older evidence:
`native-contracts-baseline-8f98abf8d18/` and `native-contracts-evidence/A4/receipt-comparison.json`. The current-schema
launch and gameplay fixtures are captured again after the unused preset field is removed; they do not use a frozen
decoder or event adapter.
