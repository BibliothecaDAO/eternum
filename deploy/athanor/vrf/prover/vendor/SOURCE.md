# STARK-curve ECVRF math

Vendored from dojoengine/stark-vrf revision f0a6d102c680ce02c482299b23ca710e8d54f2f6, version 0.1.1, MIT. Only the
curve, Poseidon hash-to-field and ECVRF math are included. No upstream service, account or provider is used. This is the
STARK/Poseidon construction, not a named RFC 9381 suite. The verifier checks the canonical SWU point; the output is
Poseidon(3, gamma.x, gamma.y, 0), independently of the proof nonce. Runtime framing and worker/native ownership are
repository code. Known-answer and cross-verifier gates live with contracts/l3/vrf-verifier.
