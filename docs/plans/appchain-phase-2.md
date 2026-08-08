# Realms Appchain — Phase 2 Research and Plan

_Status: research recommendation; implementation is not yet approved (2026-08-08)._

## Decision

Build Phase 2 as a **separate settling chain** from the Phase 1 AWS dev chain. Use the Phase 1-pinned Katana TEE release
unchanged on qualified AMD EPYC bare metal; do not fork Katana for AWS.

The recommended path is:

1. Keep Phase 1 on AWS as the sovereign dev and integration environment.
2. Prove the Phase 2 contracts and settlement flow on a separate mock-TEE/Sepolia chain.
3. Buy one month of a Latitude `m4.metal.medium` as a hardware qualification, capped at about **$500**.
4. Run a fixed-version, sealed single-host pilot only after the host passes every firmware and attestation gate below.
5. Do not put material player value at risk until a second qualified host and a drilled reconstruction path exist.

The server is not the dominant unknown. At Realms' projected peak rate, Starknet `update_state` gas and Succinct proving
can cost more than the infrastructure. Phase 2 is therefore gated on measured batch economics, not merely a successful
enclave boot.

## Scope and relationship to Phase 1

Phase 1 remains the place to iterate on Controller, paymaster, VRF, factory launches, multi-world Torii, client chain
selection, and the operational harness. Phase 2 reuses those application-level pieces but changes the trust and
settlement boundary:

```text
Phase 1 — AWS, dev, no settlement       Phase 2 — separate production chain

client / Controller / launch flow  ───────► reused
factory + game worlds              ───────► redeployed to a new genesis
Torii multi-world patch            ───────► reused on a separate Torii instance
AWS SSM/ECS indexer dispatch       ───────► provider-neutral adapter required
Katana sovereign EC2 node          ───────► Katana TEE VM on qualified bare metal
                                           │
                                           ├─ SP1 Groth16 proving
                                           └─ Piltover on Starknet mainnet
```

The current appchain indexer implementation in `config/deployer/clean/indexing/appchain-indexer.ts` is coupled to AWS
SSM and ECS. Keep that provider for Phase 1; Phase 2 needs a separate provider-neutral dispatch boundary, not a rewrite
of the working dev stack.

Phase 2 also owns the real-economy work deferred by Phase 1: LORDS entry on mainnet, prizes claimable after proven
settlement, L1↔L2 message handling, fresh production keys, and audited custody/claim contracts. Those contract and audit
costs are not included in the infrastructure estimates in this document.

## Research basis

This recommendation is grounded in:

- Eternum branch `feat/appchain-phase-1` at `53883d999701f3e8a98f533f35352762a9bfe1a4`.
- Phase 1 implementation [PR #4877](https://github.com/BibliothecaDAO/eternum/pull/4877), open against `next` and
  awaiting review when this research was recorded.
- [`cartridge-gg/dungeon-demo`](https://github.com/cartridge-gg/dungeon-demo/tree/dd72ba48e62b312e0789bc530760ceff1d888ae6)
  at `dd72ba48e62b312e0789bc530760ceff1d888ae6`.
- Katana release
  [`tee-vm-v0.4.1+katana-v1.8.0-rc.9`](https://github.com/dojoengine/katana/releases/tag/tee-vm-v0.4.1%2Bkatana-v1.8.0-rc.9)
  at `92787269bc05ab319f566b5d1f85715cb408fc17`.
- Live `CARTRIDGE_MAINNET` RPC, Piltover events, and SEV-SNP quote data observed on 2026-08-08.

Dungeon Demo is an application reference, not the operator implementation. Its public repository runs two Toriis and a
client against an external `cartridge-appchain`; the Katana node, Piltover bootstrap, settlement service, and host
automation are private. Its value here is the public entry/bank messaging pattern and a live deployment that can be
independently inspected.

## Why bare metal, not AWS SEV-SNP

Katana's pinned TEE release expects to be the virtual-machine monitor operator. Its installer requires AMD EPYC with SME
and SNP enabled in BIOS, an SNP-capable kernel, `kvm_amd sev_snp=1`, `/dev/sev`, `/dev/kvm`, and QEMU 10.2. It then
launches a measured SEV-SNP guest containing Katana. A normal confidential VM is already an SNP guest and cannot host
that nested SNP guest.

AWS offers SEV-SNP by launching supported EC2 instances with `AmdSevSnp=enabled`; AWS, not the customer, operates the
hypervisor. The current AWS support list contains selected `m6a`, `c6a`, and `r6a` virtual instance sizes, not the
`.metal` instances Katana needs as an SNP host. Shared-tenancy reports are VLEK-signed, whereas the pinned Katana
proving path fetches a VCEK chain from AMD KDS. Dedicated Hosts use VCEK but still attest the AWS guest boot boundary
rather than Katana's reproducible nested TEE VM.

Making the AWS path equivalent would mean designing and auditing a new direct-guest boot and measurement model, adding
VLEK support for shared tenancy, changing the SP1/on-chain certificate trust path, and solving storage and recovery
around an AWS-managed guest. That is a product fork, not a deployment adaptation.

Planning estimate for that AWS-specific path: **2–4 engineer-months, $90k–200k**, before an independent security review.
Even if shared EC2 saves a few hundred dollars per month, the infrastructure saving does not recover that engineering
cost on a useful horizon.

## Why no Katana fork is needed on compatible bare metal

The pinned release already provides the required production path:

- reproducible OVMF, kernel, initrd, and Katana boot artifacts;
- the host installer, QEMU launcher, expected-measurement calculation, and systemd recipe;
- real `--tee sev-snp` quotes and embedded settlement;
- SP1 Groth16 proving and Piltover submission;
- the paymaster and VRF sidecar sources, including the Phase 1 VRF revision `65d6ff0`;
- sealed LUKS2 + dm-integrity storage as an opt-in mode.

The prover currently recognizes only Milan, Genoa, Bergamo, and Siena processor models. Unknown models fail with
`unsupported processor model`. Provider selection must therefore use one of those codenames until a later release is
deliberately qualified. Do not buy a cheap EPYC 4004 server or a newer Turin server on the assumption that “SEV” is
sufficient.

This decision does not remove the existing small Torii multi-world GraphQL patch from Phase 1. It means Phase 2 needs no
additional **Katana** fork.

## Reference deployment findings

The public Dungeon deployment supports the architecture but should not be copied blindly:

- `appchain.cartridge.gg` and `dungeon-backend.cartridge.gg` resolved to `185.26.9.157`.
  [ARIN RDAP](https://rdap.arin.net/registry/ip/185.26.9.157) identifies Latitude.sh as the registrant. This is evidence
  about the current deployment, not a guarantee for any retail Latitude SKU.
- `starknet_chainId` returned `CARTRIDGE_MAINNET` and `katana_settlementStatus` returned head `490`, settled block
  `490`.
- A fresh `tee_generateQuote` for blocks `(489, 490]` returned a 1,184-byte VCEK-signed report with CPUID family `0x19`,
  model `0x11`, stepping `1` (Genoa) and measurement
  `d9e3b184ea9e880c63426a84e95afb2ad234075b2e2a6e61f033a14a7f1a9bd84bea528f90ddc79f2619d75c92e23503`.
- The report's SNP TCB was decimal `24` (`0x18`). AMD bulletin
  [AMD-SB-3034](https://www.amd.com/en/resources/product-security/bulletin/amd-sb-3034.html) requires GenoaPI `1.0.0.H`
  and `TCB[SNP] >= 0x1c` for EPYC 9004.

The last point is a hard warning: the live reference quote appears below AMD's current mitigation floor. Do not use it
as the firmware gold standard. Realms must reject a Genoa host whose reported SNP TCB is below `0x1c`, even if its quote
otherwise verifies.

## Provider shortlist

Prices are public list prices observed on 2026-08-08, before tax unless the provider says otherwise. A compatible CPU is
necessary but does not prove that the provider exposes SNP, the required BIOS controls, or current firmware.

| Provider / SKU              | Compatible hardware                   |                                Public price | SNP confidence                                                                                       | Verdict                                                             |
| --------------------------- | ------------------------------------- | ------------------------------------------: | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Latitude `m4.metal.medium`  | EPYC 9124, Genoa, 16c, 128 GB, 4 NVMe |    $456/mo monthly; $3,830/year; $1.25/hour | SKU says SEV, not explicitly SNP. Current reference IP and quote make it the best qualification lead | **First choice, conditional on preflight and written confirmation** |
| OVH `Scale-a1` 2024         | EPYC 9124, Genoa, 16c, 128 GB         |                        $437/mo + $437 setup | OVH markets SEV/confidential compute, not the exact SNP/BIOS contract needed                         | Second qualification candidate                                      |
| Hetzner `AX162-1`           | EPYC 9454P, Genoa, 48c                | $722.10/mo + $359 setup, excluding IPv4/VAT | Hardware capable; no public SNP or BIOS guarantee found                                              | Technically plausible, economically weaker                          |
| Vultr `vbm-24c-384gb-amd`   | EPYC 9254, Genoa, 24c, 384 GB         |                                     $825/mo | Direct bare-metal access and custom boot; no public SNP guarantee found                              | Technically plausible, economically weaker                          |
| Latitude `rs4.metal.xlarge` | EPYC 9554P, Genoa, 64c, 1.5 TB        |                           $3,971/mo monthly | Latitude explicitly advertises SEV-SNP attestation                                                   | Publicly clearest, radically oversized                              |

Avoid Latitude `m4.metal.small` (EPYC 4244P) despite its lower $296/month price and avoid OVH's 2026 EPYC 9135/Turin
option. Neither is in the pinned prover model allow-list.

Latitude's monthly price is 50% below its hourly price but is non-refundable; its annual reservation is 65% below hourly
and paid upfront. Buy a monthly instance for qualification, then consider the $3,830 annual commitment only after the
host and recovery design pass. Latitude's compute SLA allows up to eight hours for hardware repair or replacement after
problem identification, so one server is not an availability design.

### Purchase and preflight gates

Require the provider to confirm, and then verify on the delivered machine:

1. The exact CPU is an allowed Milan/Genoa/Bergamo/Siena model and will not be silently substituted.
2. BIOS exposes SME and SNP; the operator has root plus remote console or IPMI recovery.
3. The host kernel is SNP-capable and `/dev/sev`, `/dev/kvm`, and `/sys/module/kvm_amd/parameters/sev_snp=Y` are
   present.
4. QEMU 10.2 builds or runs and a nested Katana TEE guest reaches its RPC and metrics endpoints.
5. A live report is VCEK-signed, its certificate chain resolves through AMD KDS, and its processor model is accepted by
   the pinned SP1 prover path.
6. Genoa firmware reports GenoaPI `1.0.0.H` or later and `TCB[SNP] >= 0x1c`.
7. The live quote measurement equals the locally reproduced expected measurement for the chosen artifacts, kernel
   command line, and vCPU count.
8. The provider explains firmware maintenance, hardware replacement, disk handling, DDoS protection, and whether a
   replacement preserves the promised CPU model.

Failure of any item ends the trial. A marketing page that says “SEV” is not an exception.

## Target topology

```text
AWS Phase 1 / shared services              Qualified bare-metal provider
┌───────────────────────────────┐          ┌──────────────────────────────┐
│ dev chain                     │          │ host Linux + QEMU 10.2       │
│ client/CDN + realtime         │          │                              │
│ launch harness + run records  │          │  ┌────────────────────────┐  │
│ production Torii (separate) ──┼──────────┼─►│ SEV-SNP guest          │  │
└───────────────────────────────┘   RPC    │  │ Katana + settlement    │  │
                                           │  │ paymaster + VRF         │  │
                                           │  │ sealed data disk        │  │
                                           │  └──────────┬─────────────┘  │
                                           └─────────────┼────────────────┘
                                                         │ SP1 proof + update_state
                                                         ▼
                                          Starknet mainnet Piltover + TEE registry
```

Keep Torii and the public edge outside the enclave: they are reconstructable projections, do not belong in the attested
state transition, and should not share the sequencer's failure domain in production. The settlement account and SP1 key
belong inside the measured guest.

Katana remains a single writer. A second host is a cold or warm reconstruction target, not an active-active sequencer.
Promotion must be serialized and recorded by the operational harness so two nodes can never produce competing histories.

## Storage, upgrades, and recovery

Katana boots with plain ext4 by default. Production should use sealed storage, but its current limits are material:

- the LUKS unlock secret is bound to the physical chip's VCEK and the launch measurement;
- another chip cannot open the copied disk;
- a Katana, kernel, initrd, OVMF, command-line, or measured-vCPU change can change the measurement and make the old disk
  unreadable;
- dm-integrity detects sector tampering but not a consistent whole-disk rollback;
- the current upgrade policy is a fresh disk plus resync/reconstruction;
- an attestation-gated KMS could preserve a disk key across allow-listed measurements, but it is viable design work that
  is not built today.

Consequences for Realms:

1. Pin the TEE release throughout a season; never perform an in-place season upgrade.
2. Publish the chain spec, build inputs, expected measurement, and genesis/fork anchor.
3. Retain the old host and disk until a new measurement has settled and been verified.
4. Drill loss of the active chip. A backup that only opens on the failed chip is not a disaster-recovery backup.
5. Walk the quote chain from the pinned anchor and compare it with Piltover's settled cursor; sealing alone does not
   establish canonical history.
6. Defer an attestation-gated KMS until measurements show that fresh-disk reconstruction cannot meet the recovery
   objective.

## Cost model

### Infrastructure

The recommended incremental Phase 2 infrastructure is:

| Shape                      |          Monthly commitment | Annual-commit equivalent | What it means                                                       |
| -------------------------- | --------------------------: | -----------------------: | ------------------------------------------------------------------- |
| Qualification              | **$456 once** (budget $500) |                      n/a | One Latitude `m4.metal.medium` month; monthly fee is non-refundable |
| Single-host pilot          |             **$553–603/mo** |          **$416–466/mo** | One host + separate Torii (~$72) + $25–75 backup/monitoring/edge    |
| Two-host production target |         **$1,024–1,084/mo** |          **$750–810/mo** | Two hosts + separate Torii + $40–100 backup/monitoring/edge         |

The annual figures use Latitude's $3,830/year price and should not be committed before the qualification and recovery
drills. Add the existing Phase 1 AWS estimate of **$230–275/mo** while both environments run:

- Phase 1 plus single-host Phase 2: **about $783–878/month** on monthly commitments.
- Phase 1 plus two-host Phase 2: **about $1,254–1,359/month** on monthly commitments.

These totals exclude Starknet settlement gas, Succinct proving, contract deployment gas, security audits, tax, and staff
on-call time.

### Starknet settlement gas: measured reference

The Dungeon mainnet Piltover is
[`0x5067…1010`](https://voyager.online/contract/0x506732b3a74da0fb514c158cb866d87fc355ea37014c5cb0003cbe01e991010). On
2026-08-08 its complete visible `StateUpdated` history contained 137 successful transactions, advancing through appchain
block 490:

| Metric             |                                                                                              Observed value |
| ------------------ | ----------------------------------------------------------------------------------------------------------: |
| Total actual fee   |                                                                                             1,036.4386 STRK |
| Average per update |                                                                                                 7.5652 STRK |
| Minimum / maximum  |                                                                                        7.0250 / 8.8326 STRK |
| Latest update      | [`0x52cb…4b9`](https://voyager.online/tx/0x52cbcb8701a351a7a51da0846dd42397ab815b8596f52d06273e25f8cecf4b9) |

Method: paginate `starknet_getEvents` for the Piltover address, select the `StateUpdated` event key
`0x281848a2ead29305005a1178671c6a7d7780cb656c57678566ea8033dbfa001`, fetch every transaction receipt, and sum
`actual_fee.amount` in FRI (10^-18 STRK).

At an illustrative **$0.03/STRK** snapshot, that is about $0.227 per update and $31.09 for the observed history. Always
budget in STRK first:

```text
monthly settlement STRK
  ≈ ceil(active blocks per month / settlement batch size) × 7.5652 STRK
```

Using Phase 1's peak estimate of 500–700 chain transactions per minute, one peak hour per day, 30 days, and the
deliberately conservative assumption that one transaction produces one block:

| Batch size | Updates/month |      STRK/month | USD at $0.03/STRK |
| ---------: | ------------: | --------------: | ----------------: |
|         32 | 28,125–39,375 | 212,773–297,882 |      $6,383–8,936 |
|        256 |   3,516–4,922 |   26,599–37,236 |        $798–1,117 |
|        512 |   1,758–2,461 |   13,300–18,618 |          $399–559 |
|      1,024 |     879–1,231 |     6,650–9,313 |          $199–279 |

This is a sensitivity model, not a forecast. Multiple transactions may share a block; idle partial-batch flushes can add
updates; gas and STRK/USD both move. Measure actual Phase 1 blocks per game hour, then dry-run batch sizes 256, 512, and
1,024 on Sepolia. Choose the largest batch whose proof plus settlement latency still meets the product's
withdrawal/finality target.

### SP1 proving

Each settlement batch also requests an SP1 Groth16 proof. The Succinct Prover Network uses PROVE for payment; there is
no stable public flat price suitable for this budget. The pinned Katana release already records proof cycles, prover gas
used, prover gas price, and `deduction_amount` per block range.

Before mainnet approval, run a sustained load test and report:

- STRK actual fee per `update_state`;
- PROVE `deduction_amount` per batch and per appchain block;
- proof queue and end-to-end settlement latency at batch sizes 256, 512, and 1,024;
- monthly cost at low, expected, and 3× token-price scenarios.

No mainnet launch budget is credible until this number is measured.

### Engineering and assurance

These are planning ranges, not vendor quotes:

| Delivery level                             |                    Effort |            Budget range |
| ------------------------------------------ | ------------------------: | ----------------------: |
| Hardware qualification and reference spike |        1–2 engineer-weeks |                 $8k–25k |
| Operable single-host Phase 2               |        3–5 engineer-weeks |                $25k–60k |
| Two-host recovery, promotion, and drills   | 6–10 engineer-weeks total |               $50k–120k |
| Independent TEE/settlement security review |       separate engagement |                $30k–80k |
| AWS-specific Katana/attestation fork       |       2–4 engineer-months | $90k–200k before review |

Compatible bare metal moves the work from cryptographic product development to provider qualification, deployment
automation, monitoring, and recovery. That is the core economic reason for the recommendation.

## Delivery gates

### P2.0 — Mock settlement, separate genesis

- Bootstrap a distinct rollup and mock TEE registry on Sepolia.
- Port the Dungeon entry/bank messaging pattern to LORDS entry and prize claims.
- Exercise Controller, paymaster, VRF, factory, multi-world Torii, and settlement-status gating end to end.
- Load-test batch sizes and record blocks, Starknet estimates, and application finality.

Mock and real modes deploy different verifier contracts and are not interchangeable after initialization. Never promote
the mock chain or its registry to production.

### P2.1 — One-month hardware qualification

- Purchase the Latitude monthly SKU with the provider confirmations above.
- Install the exact pinned TEE release without a Katana fork.
- Produce and independently decode a VCEK quote.
- Pass the AMD-SB-3034 firmware floor and reproduce the launch measurement.
- Run seven days of sustained sequencing, proving, settling, monitoring, and fault tests.

Exit with a signed qualification artifact containing the CPU/CPUID, BIOS and kernel evidence, TCB values, quote,
expected measurement, artifact hashes, and cost observations.

### P2.2 — Single-host pilot

- Bootstrap fresh real-registry chain config; never reuse mock genesis.
- Run sealed, pinned-version storage and keep Torii outside the enclave.
- Fund settlement and PROVE accounts with balance alarms and daily spend limits.
- Publish the chain anchor and expected measurement.
- Drill guest restart, host restart, settlement retry, Torii reindex, and old-release rollback before admitting limited
  value.

### P2.3 — Real-value production gate

- Qualify a second host, preferably in another failure domain.
- Prove reconstruction after loss of the first chip and sealed disk.
- Enforce single-writer promotion through the launch/incident harness.
- Complete contract and TEE/settlement security reviews.
- Approve measured monthly limits for STRK and PROVE, with automatic stop/alert policies.

## Go / no-go summary

Proceed with the **$500 Latitude qualification month**. If `m4.metal.medium` passes, use it for the single-host pilot
and budget roughly **$553–603/month incremental** until the system earns an annual commitment. Target
**$1,024–1,084/month incremental** for the two-host production posture.

Do not proceed to real-value production if any of these remain unresolved:

- no written SNP/BIOS/firmware commitment for the delivered SKU;
- Genoa `TCB[SNP] < 0x1c`;
- quote measurement cannot be independently reproduced;
- sealed-state reconstruction cannot survive loss of the active chip;
- monthly Starknet plus PROVE spend at an acceptable finality target is uneconomic;
- custody, entry, prize, and cross-chain message contracts have not been reviewed.

## Sources

- [Katana TEE host installer and prerequisites](https://github.com/dojoengine/katana/blob/92787269bc05ab319f566b5d1f85715cb408fc17/misc/AMDSEV/docs/install.md)
- [Katana SEV-SNP storage and trust model](https://github.com/dojoengine/katana/blob/92787269bc05ab319f566b5d1f85715cb408fc17/docs/amdsev.md)
- [Katana TEE settlement deployment guide](https://github.com/dojoengine/katana/blob/92787269bc05ab319f566b5d1f85715cb408fc17/docs/tee-deployment.md)
- [Katana processor allow-list and SP1 cost telemetry](https://github.com/dojoengine/katana/blob/92787269bc05ab319f566b5d1f85715cb408fc17/crates/settlement/src/backend/tee/prover.rs#L209-L344)
- [Katana sidecar revisions](https://github.com/dojoengine/katana/blob/92787269bc05ab319f566b5d1f85715cb408fc17/sidecar-versions.toml)
- [Dungeon Demo application and live deployment](https://github.com/cartridge-gg/dungeon-demo/tree/dd72ba48e62b312e0789bc530760ceff1d888ae6)
- [AWS SEV-SNP model, instance support, signatures, and pricing](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/sev-snp.html)
- [AMD-SB-3034 firmware and attestation TCB floors](https://www.amd.com/en/resources/product-security/bulletin/amd-sb-3034.html)
- [Latitude confidential compute](https://www.latitude.sh/solutions/confidential-compute),
  [m4.metal.medium pricing](https://www.latitude.sh/pricing/m4-metal-medium), and
  [billing commitments](https://www.latitude.sh/docs/billing/on-demand-vs-reserved), plus the
  [compute SLA](https://www.latitude.sh/docs/slas/compute)
- [OVH bare-metal pricing](https://www.ovhcloud.com/en/bare-metal/prices/)
- [Hetzner AX162 hardware](https://www.hetzner.com/dedicated-rootserver/ax162/) and
  [2026 price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- [Vultr bare-metal plans API](https://api.vultr.com/v2/plans-metal?per_page=500) and
  [bare-metal operating model](https://docs.vultr.com/products/compute/instances/bare-metal/faq)
- [Succinct Prover Network FAQ](https://explorer.succinct.xyz/faq)
- [STRK price reference](https://www.coingecko.com/en/coins/starknet)
