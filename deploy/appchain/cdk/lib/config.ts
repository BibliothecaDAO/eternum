// Central knobs for the Realms appchain stacks. Everything here is a plain
// constant on purpose — one environment (dev) for Phase 1, a second block gets
// added when the Phase 2 settling chain exists.

import { GAME_CHAIN_NAMES } from "../../../../packages/chain/src/game-chains";

export const CONFIG = {
  /** GitHub repo allowed to assume the OIDC roles. */
  githubRepo: "BibliothecaDAO/eternum",

  /** Delegated public zone (NS record added in the realms.world DNS panel). */
  zoneName: "appchain.realms.world",

  dev: {
    /**
     * Public hostnames fronted by Cloudflare (proxied A records -> the box's
     * Elastic IP). Cloudflare terminates TLS with its own certificate
     * (Flexible mode: origin speaks plain HTTP on :80, nginx routes by Host
     * header). They must be SINGLE-level subdomains: Cloudflare's Universal
     * SSL covers `*.jcndata.com` but not `*.appchain.jcndata.com`, which
     * would fail TLS.
     */
    publicKatanaHost: "katana.jcndata.com",
    publicToriiHost: "torii.jcndata.com",
    publicToriiEternumHost: "torii-eternum.jcndata.com",
    /**
     * Game client bucket. The name MUST equal the hostname: S3 website
     * endpoints route by Host header, so a CNAME only resolves to the right
     * bucket when they match. Cloudflare proxies it and terminates TLS
     * (the S3 website endpoint is HTTP-only, which is why the zone runs in
     * Flexible mode).
     */
    publicClientHost: "play.jcndata.com",

    /**
     * Bespoke chain id. Never SN_SEPOLIA — the Controller keychain must be
     * able to distinguish this chain (cagecalls lesson; validated in M0).
     */
    chainId: GAME_CHAIN_NAMES.appchain,

    /**
     * Sequencer host. m7a vCPUs are full physical Genoa cores (no SMT) with
     * the best per-core performance in the M family — what katana wants,
     * since block execution is effectively single-core per chain. 4 vCPU
     * covers dev playtests of 6–10 players (~4–6 players per core measured)
     * plus the colocated toriis and nginx; 24-player games are a prod
     * (Latitude) concern.
     *
     * Type changes are applied as stop → modify → start, and the chain data
     * lives on a separate RETAIN volume mounted by UUID, so the chain
     * survives them. That is the whole reason katana is on EC2 rather than
     * Fargate. (Quota history: account was capped at 1 vCPU until 2026-08-13,
     * now 256.)
     */
    katanaInstanceType: "m7a.xlarge",
    katanaDataGib: 50,

    /** Empty-block heartbeat interval (rc.9's --block-time is broken). */
    heartbeatSeconds: 30,

    /** Alarm + budget notifications. */
    alertEmail: "jean.christophe.mehr@gmail.com",
  },

  ecr: {
    katanaRepo: "realms-appchain/katana",
    toriiRepo: "realms-appchain/torii",
    /** Tags pushed by scripts/push-images.sh (digest-pinned at deploy time). */
    katanaTag: "rc9-vrf-paymaster-v1",
    toriiTag: "1.8.16-mw-dynamic-v5",
  },
} as const;
