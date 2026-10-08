Throwaway spike; rewrite before reuse.

Source: https://github.com/dojoengine/stark-vrf at f0a6d102c680ce02c482299b23ca710e8d54f2f6.
Cairo package stark_vrf 0.1.1 declares MIT and authors gswirski and Cartridge.
Only verification/proving math is copied; no VRF service, paymaster, provider or account integration.
Cairo compatibility change: import core::felt252_div instead of redeclaring its extern.
Rust uses the same revision's ark-ec/ark-ff 0.5 implementation; library-only upstream tests are excluded.
The signature format is five proof felts after the account's three felts.
