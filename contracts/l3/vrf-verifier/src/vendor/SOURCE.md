# STARK-curve ECVRF verifier

Verification math from [dojoengine/stark-vrf](https://github.com/dojoengine/stark-vrf), version 0.1.1, revision
`f0a6d102c680ce02c482299b23ca710e8d54f2f6`, MIT (gswirski and Cartridge; licence beside this note). This vendors the
STARK-curve/Poseidon construction, not a named RFC 9381 suite. No upstream account, service or provider is included. The
Rust prover vendors the same mathematical revision.

Local changes: Cairo 2.17 uses `core::felt252_div`; invalid square-root hints, denominator/point failures and
noncanonical proof scalars return typed errors instead of unwrapping attacker-controlled input. The canonical SWU sign
remains tied to the hashed seed. The root is Poseidon(3, gamma.x, gamma.y, 0); neither the proof nonce nor the hint
chooses a root.

Repository framing is separate from the math: `Verifier.verify` is a read-only library entry, reads the nine-felt tagged
transaction signature and transaction hash itself, and receives the immutable constructor public point and fixed
resource bound from Games. The library checks the ordinary fixed-fee V3 frame before it parses a proof. Games pins this
verifier's generated class hash in its bytecode. It never takes an operator-selected verifier class. The library writes
no storage, has no registry and knows no game order, head, counter or epoch.
