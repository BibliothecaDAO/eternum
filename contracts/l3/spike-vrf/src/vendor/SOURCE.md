Throwaway spike; rewrite before reuse.

Source: https://github.com/dojoengine/stark-vrf at f0a6d102c680ce02c482299b23ca710e8d54f2f6. Cairo package stark_vrf
0.1.1 declares MIT and authors gswirski and Cartridge. Only verification/proving math is copied; no VRF service,
paymaster, provider or account integration. Cairo compatibility change: import core::felt252_div instead of redeclaring
its extern. Rust uses the same revision's ark-ec/ark-ff 0.5 implementation; library-only upstream tests are excluded.
The signature format is a VRF1 tag and five proof felts after the account's three felts. A native test constructs eight
valid nonce variants and checks their identical gamma/output. Verification is compiled into the game host, whose
constructor owns the immutable public key; there is no selectable verifier dependency. account_helpers.cairo copies only
execute_calls/execute_single_call/is_tx_version_valid and their constants from OpenZeppelin account2.0.0 utils.cairo;
MIT license in OZ-LICENSE. This avoids downloading unused account-library modules and Cairo2.18 transitive dependencies,
while preserving the current account helper behavior.
